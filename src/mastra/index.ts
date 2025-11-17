import "dotenv/config";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { PostgresStore } from "@mastra/pg";
import authenticationMiddleware from "./api/middlewares/authentication.middleware";
import loggingMiddleware from "./api/middlewares/logging.middileware";

// Routes import
import evaluationRoutes from "./api/modules/evaluation/evaluation.route";
import translationRoutes from "./api/modules/translation/translation.route";
import massEvaluationRoutes from "./api/modules/mass-evaluation/mass-evaluation.route";
import evaluationWorkflow from "./workflows/evaluation/evaluation.workflow";

// Workflow import
import evaluationSyncWorkflow from "./workflows/evaluation/evaluation-sync.workflow";
import translationWorkflow from "./workflows/translation/translation.workflow";
import dbGenerationWorkflow from "./workflows/db-generation/db-generation.workflow";

// Agent import
import erdInformationExtractAgent from "./agents/evaluation/erd-information-extract.agent";
import erdEvaluationAgent from "./agents/evaluation/erd-evaluation.agent";
import translatorAgent from "./agents/evaluation/translator.agent";
import ddlScriptGenerationAgent from "./agents/db-generation/ddl-script-generation-agent";
import schemaGenerationAgent from "./agents/db-generation/schema-generation-agent";
import {
  chatRoute,
  getConversationRoute,
  resetConversationRoute,
} from "../api/api-routes";

// Configure storage based on environment
const storage = process.env.DATABASE_URL
  ? new PostgresStore({
      connectionString: process.env.DATABASE_URL,
    })
  : new PostgresStore({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "eap_db",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "password",
    });

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
  storage,
  logger: new PinoLogger({
    name: "EAP AI Service",
    level: (process.env.MASTRA_LOG_LEVEL as any) || "info",
  }),
  server: {
    port: parseInt(process.env.PORT || "4111"),
    timeout: 300000, // 5 minutes for AI processing
    cors: {
      origin: ["*"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["*", "X-User-Token"], // Allow custom header
      credentials: true,
    },
    // Register custom API routes for database generation
    middleware: [loggingMiddleware, authenticationMiddleware],
    apiRoutes: [
      // Evaluation routes
      ...evaluationRoutes,
      ...translationRoutes,

      // Mass evaluation routes
      ...massEvaluationRoutes,

      chatRoute,
      getConversationRoute,
      resetConversationRoute,
    ],
  },
});
