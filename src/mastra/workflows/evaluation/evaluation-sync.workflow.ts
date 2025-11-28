import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import erdInformationExtractStep from "./steps/erd-information-extract.step";
import erdEvaluationStep from "./steps/erd-evaluation.step";

const evaluationSyncWorkflow = createWorkflow({
  id: "evaluationSyncWorkflow",
  inputSchema: z.object({
    isStream: z.boolean().optional().default(false),
    erdImage: z.string().url(),
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
  .then(erdInformationExtractStep)
  .map(async ({ inputData, getInitData }) => {
    return {
      isStream: getInitData().isStream,
      questionDescription: getInitData().questionDescription,
      extractedInformation: inputData,
      preferredFormat: getInitData().preferredFormat,
    };
  })
  .then(erdEvaluationStep)
  .commit();

export default evaluationSyncWorkflow;
