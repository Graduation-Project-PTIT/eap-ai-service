import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import dbInformationExtractStep from "./steps/db-information-extract.step";
import dbEvaluationStep from "./steps/db-evaluation.step";

const dbEvaluationSyncWorkflow = createWorkflow({
  id: "dbEvaluationSyncWorkflow",
  inputSchema: z.object({
    isStream: z.boolean().optional().default(false),
    erdImage: z.url(),
    questionDescription: z.string(),
    userToken: z.string().optional(), // Add user token
    preferredFormat: z.enum(["json", "ddl", "mermaid"]).default("json"), // Format for evaluation
  }),
  outputSchema: z.object({
    evaluationReport: z.string(),
    score: z.number().min(0).max(100),
  }),
})
  .map(async ({ inputData }) => {
    return {
      erdImage: inputData.erdImage,
      userToken: inputData.userToken,
    };
  })
  .then(dbInformationExtractStep)
  .map(async ({ inputData, getInitData }) => {
    return {
      isStream: getInitData().isStream,
      questionDescription: getInitData().questionDescription,
      extractedInformation: inputData,
      preferredFormat: getInitData().preferredFormat,
    };
  })
  .then(dbEvaluationStep)
  .commit();

export default dbEvaluationSyncWorkflow;
