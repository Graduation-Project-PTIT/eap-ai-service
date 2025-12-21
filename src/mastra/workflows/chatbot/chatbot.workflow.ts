import { createWorkflow } from "@mastra/core";
import z from "zod";
import dbInformationGenerationSchema from "../../../schemas/dbInformationGenerationSchema";
import erdInformationGenerationSchema from "../../../schemas/erdInformationGenerationSchema";
import sideQuestionStep from "./steps/side-question-step";
import schemaWorkflowBranchStep from "./steps/schema-workflow-branch-step";
import erdWorkflowBranchStep from "./steps/erd-workflow-branch-step";

/**
 * Chatbot Workflow
 *
 * This workflow routes messages based on pre-classified intent from the handler.
 * Intent classification happens BEFORE this workflow to enable smart context building.
 *
 * Routes:
 * - Side questions → answered directly
 * - Schema requests with ERD type → routed to erd-generation workflow
 * - Schema requests with PHYSICAL_DB type → routed to db-generation workflow
 *
 * Flow:
 * 1. Receive pre-classified intent from handler
 * 2. Branch based on intent and diagramType:
 *    - If "side-question" → Side Question Step → End
 *    - If "schema" + "ERD" → ERD Workflow Branch → End
 *    - If "schema" + "PHYSICAL_DB" → Schema Workflow Branch → End
 */

// Both branch outputs must have the same schema (Mastra requirement)
// All fields are present in both branches, with optional values where needed
const branchOutputSchema = z.object({
  response: z.string().optional(),
  updatedSchema: dbInformationGenerationSchema.optional(), // Physical DB schema
  updatedErdSchema: erdInformationGenerationSchema.optional(), // ERD schema
  ddlScript: z.string().optional(),
  agentResponse: z.string().optional(),
  isSideQuestion: z.boolean(),
  isSchemaGeneration: z.boolean(),
  isErdGeneration: z.boolean().optional(),
});

const chatbotWorkflow = createWorkflow({
  id: "chatbotWorkflow",

  // Input: Structured input with separated concerns for tools vs LLM
  inputSchema: z.object({
    userMessage: z
      .string()
      .min(1)
      .describe("The user's current message (for search tools)"),
    fullContext: z
      .string()
      .describe("Full context including schema + history (for LLM)"),
    domain: z
      .string()
      .nullable()
      .describe("Business domain context for search query enrichment"),
    schemaContext: z
      .string()
      .nullable()
      .describe("Current database schema DDL"),
    conversationHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
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
      .describe("Enable or disable web search tool for schema generation"),
  }),

  // Output: Union type that can be either side question response or schema generation result
  outputSchema: branchOutputSchema,
})
  // Branch based on pre-classified intent from handler
  .branch([
    // If intent is "side-question" → run side question step
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
    // If intent is "schema" and diagramType is "ERD" → run ERD workflow
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
    // If intent is "schema" and diagramType is "PHYSICAL_DB" → run schema workflow
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
