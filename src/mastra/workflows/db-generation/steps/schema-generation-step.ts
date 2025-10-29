import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import businessDomainSearchTool from "../../../tools/business-domain-search.tool";
import dbDesignPatternSearchTool from "../../../tools/db-design-pattern-search.tool";
import {
  summarizeSearchResult,
  formatSummarizedContext,
  type SummarizedSearchResult,
} from "../utils/content-summarizer";
import schemaGenerationPrompt from "../../../agents/db-generation/prompts/schema-generation-prompt";

/**
 * Conversational Schema Step (Optimized)
 *
 * Simplified flow:
 * 1. If enableSearch = true → Execute searches in parallel
 * 2. Summarize full content (80-90% compression)
 * 3. Pass summarized context + user message to LLM
 * 4. LLM returns structured output (Zod validated)
 * 5. No tool calling, single inference, fast & cheap
 */
const schemaGenerationStep = createStep({
  id: "schemaGenerationStep",

  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    userMessage: z.string().min(1),
    enableSearch: z.boolean().optional().default(false), // Default to false for simplicity
  }),

  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
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

  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("schemaGenerationAgent");

    console.log(`🔄 Processing schema generation request`);
    console.log(`🧵 Thread: ${inputData.threadId}`);
    console.log(`📦 Resource: ${inputData.resourceId}`);
    console.log(`� Search enabled: ${inputData.enableSearch}`);

    const startTime = Date.now();

    try {
      let searchContext = "";
      let searchMetadata: any = {
        searchPerformed: false,
      };

      // ===== STEP 1: Execute Backend Searches (if enabled) =====
      if (inputData.enableSearch) {
        console.log(`🔍 Executing backend searches...`);

        const searchStartTime = Date.now();

        // Execute BOTH searches in parallel (always do both when enabled)
        // Note: Search engines are smart - we can pass the user message directly
        // They'll extract relevant keywords automatically
        const [businessResult, patternResult] = await Promise.allSettled([
          (businessDomainSearchTool as any).execute({
            context: { domain: inputData.userMessage },
            runtimeContext: {},
          }),
          (dbDesignPatternSearchTool as any).execute({
            context: { pattern: inputData.userMessage },
            runtimeContext: {},
          }),
        ]);

        const searchDuration = Date.now() - searchStartTime;
        console.log(`⏱️  Search execution took: ${searchDuration}ms`);

        // ===== STEP 2: Summarize Search Results =====
        let businessSummary: SummarizedSearchResult | null = null;
        let patternSummary: SummarizedSearchResult | null = null;

        if (businessResult.status === "fulfilled" && businessResult.value) {
          const data = businessResult.value;
          businessSummary = await summarizeSearchResult(
            data.searchQuery,
            data.fullContent,
            "business"
          );
        } else {
          console.warn(
            "⚠️  Business search failed:",
            businessResult.status === "rejected"
              ? businessResult.reason
              : "No result"
          );
        }

        if (patternResult.status === "fulfilled" && patternResult.value) {
          const data = patternResult.value;
          patternSummary = await summarizeSearchResult(
            data.searchQuery,
            data.fullContent,
            "pattern"
          );
        } else {
          console.warn(
            "⚠️  Pattern search failed:",
            patternResult.status === "rejected"
              ? patternResult.reason
              : "No result"
          );
        }

        // ===== STEP 3: Format Summarized Context =====
        searchContext = formatSummarizedContext(
          businessSummary,
          patternSummary
        );

        // Calculate metadata
        const totalOriginal =
          (businessSummary?.originalWords || 0) +
          (patternSummary?.originalWords || 0);
        const totalSummarized =
          (businessSummary?.summarizedWords || 0) +
          (patternSummary?.summarizedWords || 0);

        searchMetadata = {
          searchPerformed: true,
          businessSearchTokens: businessSummary
            ? Math.ceil(businessSummary.summarizedWords * 0.75)
            : undefined,
          patternSearchTokens: patternSummary
            ? Math.ceil(patternSummary.summarizedWords * 0.75)
            : undefined,
          totalCompressionRatio:
            totalOriginal > 0 ? totalSummarized / totalOriginal : 1.0,
        };

        console.log(`📊 Search summary:`);
        console.log(
          `   - Business: ${businessSummary ? `${businessSummary.originalWords} → ${businessSummary.summarizedWords} words` : "failed"}`
        );
        console.log(
          `   - Pattern: ${patternSummary ? `${patternSummary.originalWords} → ${patternSummary.summarizedWords} words` : "failed"}`
        );
        console.log(
          `   - Total compression: ${(searchMetadata.totalCompressionRatio * 100).toFixed(0)}%`
        );
      }

      // ===== STEP 4: Build Enhanced User Message =====
      const enhancedUserMessage = searchContext
        ? `${searchContext}\n\n## User Request\n\n${inputData.userMessage}`
        : inputData.userMessage;

      // ===== STEP 5: Call Agent with Structured Output =====
      console.log(`🤖 Calling LLM with structured output...`);

      const agentOptions: any = {
        instructions: schemaGenerationPrompt,
        memory: {
          resource: inputData.resourceId,
          thread: inputData.threadId,
        },
        // ✅ ENABLE STRUCTURED OUTPUT!
        // The output schema should match what the LLM generates (entities + explanation)
        output: erdInformationGenerationSchema.extend({
          explanation: z
            .string()
            .describe("Detailed explanation of the schema design decisions"),
        }),
      };

      const result = await agent.generate(enhancedUserMessage, agentOptions);

      const totalDuration = Date.now() - startTime;
      console.log(`⏱️  Total processing time: ${totalDuration}ms`);

      // ===== STEP 6: Extract Structured Response =====
      const resultWithObject = result as any;
      if (!resultWithObject.object) {
        throw new Error("Agent failed to generate structured response");
      }

      const parsedResponse = resultWithObject.object as {
        entities: any[];
        explanation: string;
      };

      // Validate that entities array exists
      if (!parsedResponse.entities || !Array.isArray(parsedResponse.entities)) {
        console.error("❌ Invalid response structure:", parsedResponse);
        throw new Error("Agent response missing entities array");
      }

      console.log(`✅ Schema generated successfully`);
      console.log(
        `📋 Entities: ${parsedResponse.entities.map((e: any) => e.name).join(", ")}`
      );

      return {
        threadId: inputData.threadId,
        resourceId: inputData.resourceId,
        updatedSchema: { entities: parsedResponse.entities },
        agentResponse: parsedResponse.explanation,
        searchMetadata,
      };
    } catch (error) {
      console.error("❌ Schema generation failed:", error);
      throw new Error(
        `Schema generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export default schemaGenerationStep;
