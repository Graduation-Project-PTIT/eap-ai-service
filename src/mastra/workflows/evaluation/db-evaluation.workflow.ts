import { createStep, createWorkflow } from "@mastra/core";
import { z } from "zod";
import dbInformationExtractStep from "./steps/db-information-extract.step";
import dbEvaluationStep from "./steps/db-evaluation.step";
import diagramTypeDetectorStep from "./steps/diagram-type-detector.step";
import erdInformationExtractStep from "./steps/erd-information-extract.step";
import erdEvaluationStep from "./steps/erd-evaluation.step";

const dbEvaluationWorkflow = createWorkflow({
  id: "dbEvaluationWorkflow",
  inputSchema: z.object({
    erdImage: z.url(),
    questionDescription: z.string(),
    userToken: z.string().optional(),
    preferredFormat: z.enum(["json", "ddl", "mermaid"]).default("json"),
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
    console.log("DB EVALUATION WORKFLOW - MAPPED", inputData);
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
  .waitForEvent(
    "finish-refinement",
    createStep({
      id: "finishRefinementStep",
      inputSchema: z.object({
        dbInformationExtractStep: z.any(),
        erdInformationExtractStep: z.any(),
      }),
      outputSchema: z.object({
        extractedInformation: z.any(),
        diagramType: z.enum(["ERD", "PHYSICAL_DB"]),
      }),
      execute: async ({ inputData }) => {
        const data = inputData.erdInformationExtractStep
          ? inputData.erdInformationExtractStep
          : inputData.dbInformationExtractStep;
        return {
          extractedInformation: data,
          diagramType: data.type,
        };
      },
    })
  )
  .map(async ({ inputData, getInitData }) => {
    console.log("FINISH REFINEMENT - MAPPED", inputData);
    return {
      questionDescription: getInitData().questionDescription,
      extractedInformation: inputData.extractedInformation,
      preferredFormat: getInitData().preferredFormat,
      diagramType: inputData.diagramType,
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

export default dbEvaluationWorkflow;
