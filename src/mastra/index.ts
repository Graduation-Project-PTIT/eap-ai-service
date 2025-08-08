import { Mastra } from "@mastra/core/mastra";
import evaluationWorkflow from "./workflows/evaluation/evaluation.workflow";
import erdInformationExtractAgent from "./agents/erd-information-extract.agent";
import erdEvaluationAgent from "./agents/erd-evaluation.agent";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

// Load environment variables
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost", "https://eap.thanhnd.site"];

export const mastra = new Mastra({
  workflows: {
    evaluationWorkflow,
  },
  agents: {
    erdInformationExtractAgent,
    erdEvaluationAgent,
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  server: {
    port: parseInt(process.env.PORT || "4111"), // Default port for evaluation service
    timeout: 300000, // 5 minutes for AI processing
    cors: {
      origin: ["*"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["*"],
      credentials: true,
    },
  },
});
