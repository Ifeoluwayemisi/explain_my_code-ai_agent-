import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { explainAgent } from "./../mastra/agents/explain_agent.ts";
import { a2aAgentRoutes } from "./../mastra/routes/a2a_agent_route.ts";

export const mastra = new Mastra({
  agents: { explainAgent },
  storage: new LibSQLStore({ url: ":memory:" }),
  logger: new PinoLogger({ name: "Mastra", level: "debug" }),
  observability: { default: { enabled: true } },
  server: {
    build: { openAPIDocs: true, swaggerUI: true },
    apiRoutes: [a2aAgentRoutes],
  },
});
