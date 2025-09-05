import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import erdInformationExtractStep from "./steps/erd-information-extract.step";
import erdInformationExtractSchema from "../../../schemas/erdInformationExtractSchema";
import erdEvaluationStep from "./steps/erd-evaluation.step";

const evaluationWorkflow = createWorkflow({
  id: "evaluationWorkflow",
  inputSchema: z.object({
    erdImage: z.string().url(),
    questionDescription: z.string(),
    userToken: z.string().optional(), // Add user token
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
      questionDescription: getInitData().questionDescription,
      extractedInformation: inputData,
    };
  })
  .waitForEvent("finish-refinement", erdEvaluationStep)
  .commit();

export default evaluationWorkflow;
