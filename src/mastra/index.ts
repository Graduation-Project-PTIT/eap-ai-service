import "dotenv/config";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { AISDKExporter } from "langsmith/vercel";

// Evaluation workflows
import evaluationWorkflow from "./workflows/evaluation/evaluation.workflow";
import evaluationSyncWorkflow from "./workflows/evaluation/evaluation-sync.workflow";
import translationWorkflow from "./workflows/translation/translation.workflow";

// Database generation workflows
import dbGenerationWorkflow from "./workflows/db-generation/db-generation.workflow";

// Evaluation agents
import erdInformationExtractAgent from "./agents/evaluation/erd-information-extract.agent";
import erdEvaluationAgent from "./agents/evaluation/erd-evaluation.agent";
import translatorAgent from "./agents/evaluation/translator.agent";

// Database generation agents
import ddlScriptGenerationAgent from "./agents/db-generation/ddl-script-generation-agent";
import schemaGenerationAgent from "./agents/db-generation/schema-generation-agent";
// Memory configuration
import { memory } from "./memory";

// Custom API routes
import {
  chatRoute,
  getConversationRoute,
  resetConversationRoute,
  healthRoute,
} from "../api/api-routes";

// Validate required environment variables
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error(
    "❌ Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is required"
  );
  console.error("💡 Please set it in your .env file or environment");
  process.exit(1);
}

// Load CORS origins from environment
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost", "https://localhost:3000"];

export const mastra = new Mastra({
  workflows: {
    // Evaluation workflows
    evaluationWorkflow,
    evaluationSyncWorkflow,
    translationWorkflow,
    // Database generation workflows
    dbGenerationWorkflow,
  },
  agents: {
    // Evaluation agents
    erdInformationExtractAgent,
    erdEvaluationAgent,
    translatorAgent,
    // Database generation agents
    ddlScriptGenerationAgent,
    schemaGenerationAgent,
  },
  // Shared storage for workflows and global state (in-memory for simplicity)
  // Agent-specific memory is configured in each agent
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "EAP AI Service",
    level: (process.env.MASTRA_LOG_LEVEL as any) || "info",
  }),
  server: {
    port: parseInt(process.env.PORT || "4111"),
    timeout: 300000, // 5 minutes for AI processing
    cors: {
      origin: corsOrigins,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["*", "X-User-Token"], // Allow custom header
      credentials: true,
    },
    // Register custom API routes for database generation
    apiRoutes: [
      chatRoute,
      getConversationRoute,
      resetConversationRoute,
      healthRoute,
    ],
  },
  telemetry: {
    serviceName: "eap-ai-service",
    enabled: true,
    export: {
      type: "custom",
      exporter: new AISDKExporter(),
    },
  },
});

// Re-export memory for convenience
export { memory };
