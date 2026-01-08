import { createWorkflow } from "@mastra/core";
import z from "zod";
import dbInformationGenerationSchema from "../../../schemas/dbInformationGenerationSchema";
import erdInformationGenerationSchema from "../../../schemas/erdInformationGenerationSchema";
import sideQuestionStep from "./steps/side-question-step";
import schemaWorkflowBranchStep from "./steps/schema-workflow-branch-step";
import erdWorkflowBranchStep from "./steps/erd-workflow-branch-step";

const branchOutputSchema = z.object({
  response: z.string().optional(),
  updatedSchema: dbInformationGenerationSchema.optional(),
  updatedErdSchema: erdInformationGenerationSchema.optional(),
  ddlScript: z.string().optional(),
  agentResponse: z.string().optional(),
  isSideQuestion: z.boolean(),
  isSchemaGeneration: z.boolean(),
  isErdGeneration: z.boolean().optional(),
});

const chatbotWorkflow = createWorkflow({
  id: "chatbotWorkflow",

  inputSchema: z.object({
    userMessage: z
      .string()
      .min(1)
      .describe("The user's current message"),
    domain: z
      .string()
      .nullable()
      .describe("Business domain context for search query enrichment"),

    currentErdSchema: z
      .any()
      .nullable()
      .describe("Current ERD schema object"),
    currentPhysicalSchema: z
      .any()
      .nullable()
      .describe("Current Physical DB schema object"),
    currentDdl: z
      .string()
      .nullable()
      .describe("Current database schema DDL"),

    conversationHistory: z
      .array(
        z.object({
          role: z.string(),
          content: z.string(),
          createdAt: z.string().optional(),
        })
      )
      .optional()
      .describe("Previous conversation messages"),

    intent: z
      .enum(["schema", "side-question"])
      .describe("Pre-classified intent from handler"),
    schemaIntent: z
      .enum(["create", "modify"])
      .nullable()
      .describe("Sub-intent for schema operations"),
    diagramType: z
      .enum(["ERD", "PHYSICAL_DB"])
      .nullable()
      .describe("Type of diagram to generate"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence score of the classification"),
    enableSearch: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable or disable web search tool"),
  }),

  outputSchema: branchOutputSchema,
})
  .branch([
    [
      async ({
        inputData,
      }: {
        inputData: { intent: string; [key: string]: any };
      }) => {
        console.log(`🔀 Branch condition check - intent: ${inputData.intent}`);
        return inputData.intent === "side-question";
      },
      sideQuestionStep,
    ],
    [
      async ({
        inputData,
      }: {
        inputData: { intent: string; diagramType: string | null; [key: string]: any };
      }) => {
        console.log(`🔀 Branch condition check - intent: ${inputData.intent}, diagramType: ${inputData.diagramType}`);
        return inputData.intent === "schema" && inputData.diagramType === "ERD";
      },
      erdWorkflowBranchStep,
    ],
    [
      async ({
        inputData,
      }: {
        inputData: { intent: string; diagramType: string | null; [key: string]: any };
      }) => {
        console.log(`🔀 Branch condition check - intent: ${inputData.intent}, diagramType: ${inputData.diagramType}`);
        return inputData.intent === "schema" && inputData.diagramType === "PHYSICAL_DB";
      },
      schemaWorkflowBranchStep,
    ],
  ])

  .commit();

export default chatbotWorkflow;
