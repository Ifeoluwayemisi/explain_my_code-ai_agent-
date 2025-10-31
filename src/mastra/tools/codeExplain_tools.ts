import { createTool } from "@mastra/core";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cleanText, chunkText } from "../utils/parseAndChunk";

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// ✅ Bulletproof JSON parser
function safeParseJSON(text: string) {
  if (!text) return null;

  // remove markdown fences
  text = text.replace(/```json|```/g, "").trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let jsonCandidate = text.slice(start, end + 1);

  try {
    return JSON.parse(jsonCandidate);
  } catch {
    // fix dangling commas
    jsonCandidate = jsonCandidate.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    try {
      return JSON.parse(jsonCandidate);
    } catch {
      return null;
    }
  }
}

export const codeExplainTool = createTool({
  id: "codeExplainTool",
  description: "Explain programming errors and provide suggestions.",
  inputSchema: z.object({
    errorMessage: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
    suggestion: z.array(z.string()),
  }),
  execute: async ({ context }: { context: { errorMessage: string } }) => {
    const { errorMessage } = context;
    console.info("Error received:", errorMessage);

    // ✅ Fast heuristic path
    if (
      /undefined/.test(errorMessage) ||
      /Cannot read property/.test(errorMessage)
    ) {
      return {
        summary:
          "You accessed a property or called `.map()` on something undefined.",
        suggestion: [
          "Make sure the variable is initialized.",
          "Add optional chaining: value?.map(...).",
          "Verify the data finished loading before mapping.",
        ],
      };
    }

    // ✅ Fallback to Gemini AI
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
Explain this programming error clearly.

Error:
${errorMessage}

Return ONLY JSON in this format:
{
  "summary": "...",
  "suggestion": ["...", "..."]
}
`;

      const result = await model.generateContent(prompt);
      let text = await result.response.text();

      // ✅ Clean Markdown / noise
      text = cleanText(text);

      // ✅ Bulletproof JSON parse
      const parsed = safeParseJSON(text);
      if (parsed && parsed.summary) return parsed;

      // ✅ Fallback: split explanation into chunks
      const chunks = chunkText(text, 2000);
      return {
        summary: chunks[0],
        suggestion: chunks
          .slice(1)
          .map((c) => c.trim())
          .filter(Boolean),
      };
    } catch (err: any) {
      return {
        summary: "AI model could not process your error message.",
        suggestion: ["Check your Gemini API key.", "Retry the request."],
      };
    }
  },
});
