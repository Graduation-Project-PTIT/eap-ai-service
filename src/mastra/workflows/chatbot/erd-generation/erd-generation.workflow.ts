import { createWorkflow } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import erdGenerationStep from "./steps/erd-generation-step";

const erdGenerationWorkflow = createWorkflow({
  id: "erdGenerationWorkflow",

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

  outputSchema: z.object({
    updatedErdSchema: erdInformationGenerationSchema,
    agentResponse: z
      .string()
      .describe("Human-readable explanation of what was done"),
  }),
})
  .then(erdGenerationStep)
  .commit();

export default erdGenerationWorkflow;

