import { createWorkflow } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import erdGenerationStep from "./steps/erd-generation-step";

/**
 * ERD Generation Workflow
 *
 * This workflow handles ERD (Chen notation) schema creation and modification.
 * Unlike the DB generation workflow, it does NOT generate DDL scripts.
 *
 * Flow:
 * 1. Receive user message + context
 * 2. Generate ERD schema in Chen notation
 * 3. Return complete ERD schema with explanation
 *
 * Key Features:
 * - Single step workflow (no DDL generation)
 * - Chen notation support (weak entities, multivalued attributes, etc.)
 * - Returns ERD schema + explanation
 */
const erdGenerationWorkflow = createWorkflow({
  id: "erdGenerationWorkflow",

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
      .describe("Enable or disable web search tool for ERD generation"),
  }),

  // Output: ERD schema and explanation
  outputSchema: z.object({
    updatedErdSchema: erdInformationGenerationSchema,
    agentResponse: z
      .string()
      .describe("Human-readable explanation of what was done"),
  }),
})
  // Single step: ERD Schema Generation
  .then(erdGenerationStep)
  .commit();

export default erdGenerationWorkflow;

