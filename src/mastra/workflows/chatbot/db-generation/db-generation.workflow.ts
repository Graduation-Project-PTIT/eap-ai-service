import { createWorkflow } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import schemaGenerationStep from "./steps/schema-generation-step";
import ddlGenerationStep from "./steps/ddl-generation-step";

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

  // Input: Structured input with domain context for search enrichment
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
      .describe("Business domain for search query enrichment"),
    enableSearch: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable or disable web search tool for schema generation"),
  }),

  // Output: Updated schema, DDL script, and explanation
  outputSchema: z.object({
    updatedSchema: erdInformationGenerationSchema,
    ddlScript: z.string(),
    agentResponse: z
      .string()
      .describe("Human-readable explanation of what was done"),
  }),
})
  // Step 1: Schema Generation/Modification
  .then(schemaGenerationStep)

  // Step 2: DDL Script Generation
  .then(ddlGenerationStep)

  .commit();

export default dbGenerationWorkflow;
