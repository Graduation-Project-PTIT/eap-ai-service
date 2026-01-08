import { createWorkflow } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";
import schemaGenerationStep from "./steps/schema-generation-step";
import ddlGenerationStep from "./steps/ddl-generation-step";

const dbGenerationWorkflow = createWorkflow({
  id: "dbGenerationWorkflow",

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

  outputSchema: z.object({
    updatedSchema: erdInformationGenerationSchema,
    ddlScript: z.string(),
    agentResponse: z
      .string()
      .describe("Human-readable explanation of what was done"),
  }),
})
  .then(schemaGenerationStep)

  .then(ddlGenerationStep)

  .commit();

export default dbGenerationWorkflow;
