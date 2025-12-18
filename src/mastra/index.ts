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
import chatbotRoutes from "./api/modules/chatbot/chatbot.route";

// Workflow import
import dbEvaluationSyncWorkflow from "./workflows/evaluation/db-evaluation-sync.workflow";
import dbEvaluationWorkflow from "./workflows/evaluation/db-evaluation.workflow";
import translationWorkflow from "./workflows/translation/translation.workflow";
import dbGenerationWorkflow from "./workflows/chatbot/db-generation/db-generation.workflow";
import chatbotWorkflow from "./workflows/chatbot/chatbot.workflow";

// Agent import
import dbInformationExtractAgent from "./agents/evaluation/db-information-extract.agent";
import dbEvaluationAgent from "./agents/evaluation/db-evaluation.agent";
import erdInformationExtractAgent from "./agents/evaluation/erd-information-extract.agent";
import erdEvaluationAgent from "./agents/evaluation/erd-evaluation.agent";
import translatorAgent from "./agents/evaluation/translator.agent";
import ddlScriptGenerationAgent from "./agents/chatbot/db-generation/ddl-script-generation-agent";
import schemaGenerationAgent from "./agents/chatbot/db-generation/schema-generation-agent";
import intentClassificationAgent from "./agents/chatbot/intent-classification-agent";
import sideQuestionAgent from "./agents/chatbot/side-question-agent";
import diagramTypeDetectorAgent from "./agents/evaluation/diagram-type-detector.agent";

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
    dbEvaluationSyncWorkflow,
    dbEvaluationWorkflow,
    translationWorkflow,
    // Database generation workflows
    dbGenerationWorkflow,
    // Chatbot workflow
    chatbotWorkflow,
  },
  agents: {
    diagramTypeDetectorAgent,
    // Evaluation agents - Physical DB
    dbInformationExtractAgent,
    dbEvaluationAgent,
    // Evaluation agents - ERD (Chen notation)
    erdInformationExtractAgent,
    erdEvaluationAgent,
    translatorAgent,
    // Database generation agents
    ddlScriptGenerationAgent,
    schemaGenerationAgent,
    // Chatbot agents
    intentClassificationAgent,
    sideQuestionAgent,
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
      origin: process.env.CORS_ORIGIN?.split(",") || [
        "http://localhost:3001",
        "http://localhost",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["*", "X-User-Token", "Authorization", "Content-Type"],
      credentials: true,
      exposeHeaders: ["Content-Length", "Content-Type"],
    },
    // Register custom API routes for database generation
    middleware: [loggingMiddleware, authenticationMiddleware],
    apiRoutes: [
      // Evaluation routes
      ...evaluationRoutes,
      ...translationRoutes,

      // Mass evaluation routes
      ...massEvaluationRoutes,
      // Chatbot routes
      ...chatbotRoutes,
    ],
  },
});
