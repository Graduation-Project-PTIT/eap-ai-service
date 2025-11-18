import { createWorkflow } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../schemas/erdInformationGenerationSchema";
import sideQuestionStep from "./steps/side-question-step";
import schemaWorkflowBranchStep from "./steps/schema-workflow-branch-step";

/**
 * Chatbot Workflow
 *
 * This workflow routes messages based on pre-classified intent from the handler.
 * Intent classification happens BEFORE this workflow to enable smart context building.
 *
 * Routes:
 * - Side questions → answered directly
 * - Schema requests → routed to db-generation workflow
 *
 * Flow:
 * 1. Receive pre-classified intent from handler
 * 2. Branch based on intent:
 *    - If "side-question" → Side Question Step → End
 *    - If "schema" → Schema Workflow Branch → End
 */

// Both branch outputs must have the same schema (Mastra requirement)
// All fields are present in both branches, with optional values where needed
const branchOutputSchema = z.object({
  response: z.string().optional(),
  updatedSchema: erdInformationGenerationSchema.optional(),
  ddlScript: z.string().optional(),
  agentResponse: z.string().optional(),
  isSideQuestion: z.boolean(),
  isSchemaGeneration: z.boolean(),
});

const chatbotWorkflow = createWorkflow({
  id: "chatbotWorkflow",

  // Input: User message with pre-classified intent from handler
  inputSchema: z.object({
    userMessage: z
      .string()
      .min(1)
      .describe("The user's request or instruction"),
    intent: z
      .enum(["schema", "side-question"])
      .describe("Pre-classified intent from handler"),
    schemaIntent: z
      .enum(["create", "modify"])
      .nullable()
      .describe("Sub-intent for schema operations"),
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
    // If intent is "schema" → run schema workflow
    [
      async ({
        inputData,
      }: {
        inputData: { intent: string; [key: string]: any };
      }) => {
        console.log(`🔀 Branch condition check - intent: ${inputData.intent}`);
        return inputData.intent === "schema";
      },
      schemaWorkflowBranchStep,
    ],
  ])

  .commit();

export default chatbotWorkflow;
