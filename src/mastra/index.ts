import { Mastra } from "@mastra/core/mastra";
import evaluationWorkflow from "./workflows/evaluation/evaluation.workflow";
import evaluationSyncWorkflow from "./workflows/evaluation/evaluation-sync.workflow";
import translationWorkflow from "./workflows/translation/translation.workflow";
import erdInformationExtractAgent from "./agents/erd-information-extract.agent";
import erdEvaluationAgent from "./agents/erd-evaluation.agent";
import translatorAgent from "./agents/translator.agent";
import { PinoLogger } from "@mastra/loggers";
import { PostgresStore } from "@mastra/pg";
import { AISDKExporter } from "langsmith/vercel";

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
    evaluationWorkflow,
    evaluationSyncWorkflow,
    translationWorkflow,
  },
  agents: {
    erdInformationExtractAgent,
    erdEvaluationAgent,
    translatorAgent,
  },
  storage,
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
      allowHeaders: ["*", "X-User-Token"], // Allow custom header
      credentials: true,
    },
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
