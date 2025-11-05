import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoutes = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      // --- SAFE REQUEST PARSING ---
      const body = await c.req.json().catch(() => ({}));

      const jsonrpc = body?.jsonrpc;
      const requestId = body?.id ?? randomUUID();
      const method = body?.method;
      const params = body?.params ?? {};

      // --- VALIDATE JSON-RPC VERSION ---
      if (jsonrpc !== "2.0") {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: { code: -32600, message: "Invalid JSON-RPC version" },
          },
          400
        );
      }

      // --- VALIDATE METHOD ---
      if (!["message/send", "execute"].includes(method)) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: { code: -32601, message: "Method not found" },
          },
          400
        );
      }

      // --- LOOK UP AGENT ---
      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: { code: -32602, message: `Agent '${agentId}' not found` },
          },
          404
        );
      }

      // --- NORMALIZE INPUT MESSAGES ---
      let incomingMessages = [];

      if (method === "message/send" && params.message) {
        incomingMessages = [params.message];
      }

      if (method === "execute" && Array.isArray(params.messages)) {
        incomingMessages = params.messages;
      }

      if (incomingMessages.length === 0) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: { code: -32602, message: "No messages provided" },
          },
          400
        );
      }

      const contextId = params.contextId ?? randomUUID();
      const taskId = params.taskId ?? randomUUID();

      // --- CONVERT A2A MESSAGE → MASTRA MESSAGE ---
      const mastraMessages = incomingMessages.map((msg: any) => ({
        role: msg.role,
        content:
          msg.parts
            ?.map((p: any) => (p.kind === "text" ? p.text : JSON.stringify(p)))
            .join("\n") ?? "",
      }));

      // --- RUN THE AGENT ---
      const response = await agent.generate(mastraMessages);
      const agentText = response.text || "";

      // --- ARTIFACTS ---
      const artifacts = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: "text", text: agentText }],
        },
      ];

      // --- HISTORY ---
      const history = [
        ...incomingMessages.map((m: any) => ({
          kind: "message",
          role: m.role,
          parts: m.parts,
          messageId: m.messageId ?? randomUUID(),
          taskId: m.taskId ?? taskId,
        })),
        {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: agentText }],
          messageId: randomUUID(),
          taskId,
        },
      ];

      // --- FINAL A2A TASK RESULT ---
      return c.json({
        jsonrpc: "2.0",
        id: requestId,
        result: {
          id: taskId,
          contextId,
          status: {
            state: "completed",
            timeStamp: new Date().toISOString(),
            message: {
              messageId: randomUUID(),
              role: "agent",
              parts: [{ kind: "text", text: agentText }],
              kind: "message",
            },
          },
          artifacts,
          history,
          kind: "task",
        },
      });
    } catch (error: any) {
      return c.json(
        {
          jsonrpc: "2.0",
          id: randomUUID(),
          error: {
            code: -32603,
            message: "Internal error",
            data: { details: error.message },
          },
        },
        500
      );
    }
  },
});
