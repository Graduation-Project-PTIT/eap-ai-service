import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import dbInformationExtractStep from "./steps/db-information-extract.step";
import dbEvaluationStep from "./steps/db-evaluation.step";
import diagramTypeDetectorStep from "./steps/diagram-type-detector.step";
import erdInformationExtractStep from "./steps/erd-information-extract.step";
import erdEvaluationStep from "./steps/erd-evaluation.step";

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
    diagramType: z.enum(["ERD", "PHYSICAL_DB"]),
  }),
})
  .map(async ({ inputData }) => {
    return {
      erdImage: inputData.erdImage,
      userToken: inputData.userToken,
    };
  })
  .then(diagramTypeDetectorStep)
  .map(async ({ inputData, getInitData }) => {
    console.log("DB EVALUATION SYNC WORKFLOW - MAPPED", inputData);
    return {
      diagramType: inputData.diagramType,
      erdImage: getInitData().erdImage,
      userToken: getInitData().userToken,
    };
  })
  .branch([
    [
      async ({ inputData }) => inputData.diagramType === "PHYSICAL_DB",
      dbInformationExtractStep,
    ],
    [
      async ({ inputData }) => inputData.diagramType === "ERD",
      erdInformationExtractStep,
    ],
  ])
  .map(async ({ inputData, getInitData }) => {
    console.log("DB EVALUATION SYNC WORKFLOW - FINAL MAPPED", inputData);

    const data = inputData.dbInformationExtractStep
      ? inputData.dbInformationExtractStep
      : inputData.erdInformationExtractStep;

    return {
      isStream: getInitData().isStream,
      questionDescription: getInitData().questionDescription,
      extractedInformation: data,
      preferredFormat: getInitData().preferredFormat,
      diagramType: data.type,
    };
  })
  .branch([
    [
      async ({ inputData }) => inputData.diagramType === "PHYSICAL_DB",
      dbEvaluationStep,
    ],
    [
      async ({ inputData }) => inputData.diagramType === "ERD",
      erdEvaluationStep,
    ],
  ])
  .commit();

export default dbEvaluationSyncWorkflow;
