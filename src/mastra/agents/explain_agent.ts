import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { codeExplainTool } from "../tools/codeExplain_tools";

export const explainAgent = new Agent({
  name: "ExplainMyError",
  model: "google/gemini-2.0-flash",
  instructions: `
You are a helpful programming assistant that explains errors in simple English and provides likely fixes.
Behaviour:
- Detect the language (JS, Python, Java, Typescript, etc.) if possible.
- Explain the probable root cause in 1–2 sentences.
- Provide 1–2 concrete suggestions to try as fixes.
- If uncertain, ask for a code snippet or stack trace context.
- Keep responses concise and actionable.
`,
  tools: [codeExplainTool],
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:./mastra.db" }),
  }),
});
