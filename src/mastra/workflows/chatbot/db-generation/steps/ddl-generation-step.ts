import { createStep, MastraStorage } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../../schemas/dbInformationGenerationSchema";
/**
 * Conversational DDL Generation Step
 *
 * This step generates DDL script from an updated schema.
 * DDL is stored in database by the handler (not in memory).
 */
const ddlGenerationStep = createStep({
  id: "ddlGenerationStep",

  inputSchema: z.object({
    updatedSchema: erdInformationGenerationSchema,
    agentResponse: z.string(),
    searchMetadata: z
      .object({
        searchPerformed: z.boolean(),
        businessSearchTokens: z.number().optional(),
        patternSearchTokens: z.number().optional(),
        totalCompressionRatio: z.number().optional(),
      })
      .optional(),
  }),

  outputSchema: z.object({
    updatedSchema: erdInformationGenerationSchema,
    ddlScript: z.string(),
    agentResponse: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const ddlScriptGenerationAgent = mastra.getAgent(
      "ddlScriptGenerationAgent"
    );

    console.log(`🔨 DDL Generation Step`);

    // ===== STEP 1: Check if Schema is Empty (Side Question) =====
    // If entities array is empty, this was a side question - skip DDL generation
    if (
      !inputData.updatedSchema.entities ||
      inputData.updatedSchema.entities.length === 0
    ) {
      console.log(
        `⏭️  Skipping DDL generation - no schema data (side question)`
      );
      return {
        updatedSchema: inputData.updatedSchema,
        ddlScript: "", // Empty DDL for side questions
        agentResponse: inputData.agentResponse,
      };
    }

    // ===== STEP 2: Generate DDL Script =====
    // Start performance timing
    const startTime = Date.now();

    // Generate DDL script without structured output (plain SQL text)
    // Note: Not using 'output' parameter to avoid conflict with function calling
    const result = await ddlScriptGenerationAgent.generate([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(inputData.updatedSchema),
          },
        ],
      },
    ]);

    const duration = Date.now() - startTime;
    console.log(`⏱️  DDL generation took: ${duration}ms`);

    if (!result.text) {
      throw new Error("Agent failed to generate DDL script");
    }

    // Clean up the response - remove markdown code blocks if present
    let ddlScript = result.text.trim();
    if (ddlScript.startsWith("```sql")) {
      ddlScript = ddlScript.replace(/^```sql\n?/, "").replace(/\n?```$/, "");
    } else if (ddlScript.startsWith("```")) {
      ddlScript = ddlScript.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    console.log(`✅ DDL script generated successfully`);
    console.log(`📏 Script length: ${ddlScript.length} characters`);

    // Note: DDL is saved to database by the handler, not to memory

    return {
      updatedSchema: inputData.updatedSchema,
      ddlScript: ddlScript,
      agentResponse: inputData.agentResponse,
    };
  },
});
export default ddlGenerationStep;
