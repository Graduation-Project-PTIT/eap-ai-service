import { createWorkflow } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../schemas/erdInformationGenerationSchema";
import conversationalSchemaStep from "./steps/schema-generation-step";
import conversationalDdlGenerationStep from "./steps/ddl-generation-step";

/**
 * Unified Conversational Design Workflow
 *
 * This workflow handles BOTH schema creation and modification in a single flow.
 * It orchestrates the conversational schema agent and DDL generation agent.
 *
 * Flow:
 * 1. Receive user message + memory context (threadId, resourceId)
 * 2. Agent automatically retrieves conversation history from memory
 * 3. Generate DDL script from the updated schema
 * 4. Return complete result with explanation
 *
 * Key Features:
 * - Single workflow for all cases (no branching needed)
 * - Agents manage their own memory automatically
 * - Returns complete schema + DDL + explanation
 */
const dbGenerationWorkflow = createWorkflow({
  id: "dbGenerationWorkflow",

  // Input: User message and memory identifiers
  inputSchema: z.object({
    threadId: z.string().describe("Thread ID for conversation isolation"),
    resourceId: z
      .string()
      .describe("Resource ID (typically userId or conversationId)"),
    userMessage: z
      .string()
      .min(1)
      .describe("The user's request or instruction"),
    enableSearch: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable or disable web search tool for schema generation"),
  }),

  // Output: Updated schema, DDL script, and explanation
  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    updatedSchema: erdInformationGenerationSchema,
    ddlScript: z.string(),
    agentResponse: z
      .string()
      .describe("Human-readable explanation of what was done"),
  }),
})
  // Step 1: Schema Generation/Modification
  .then(conversationalSchemaStep)

  // Step 2: DDL Script Generation
  .then(conversationalDdlGenerationStep)

  .commit();

export default dbGenerationWorkflow;
