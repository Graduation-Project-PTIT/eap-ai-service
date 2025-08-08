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
  }),
  outputSchema: z.object({
    extractedInformation: erdInformationExtractSchema,
    evaluationReport: z.string(),
  }),
})
  .map(async ({ inputData }) => {
    return {
      erdImage: inputData.erdImage,
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
