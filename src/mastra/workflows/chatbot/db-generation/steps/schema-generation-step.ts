import { createStep, MastraStorage } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../../schemas/dbInformationGenerationSchema";
import businessDomainSearchTool from "../../../../tools/business-domain-search.tool";
import dbDesignPatternSearchTool from "../../../../tools/db-design-pattern-search.tool";
import schemaGenerationPrompt from "../../../../agents/chatbot/db-generation/prompts/schema-generation-prompt";
import {
  SummarizedSearchResult,
  summarizeSearchResult,
  formatSummarizedContext,
} from "../../../../utils/content-summarizer";

/**
 * Conversational Schema Step (Optimized)
 *
 * Simplified flow:
 * 1. If enableSearch = true → Execute searches in parallel
 * 2. Summarize full content (80-90% compression)
 * 3. Pass summarized context + user message to LLM
 * 4. LLM returns structured output (Zod validated)
 * 5. If entities array is empty → side question, skip memory update
 * 6. If entities array has data → schema modification, update memory
 */
const schemaGenerationStep = createStep({
  id: "schemaGenerationStep",

  inputSchema: z.object({
    userMessage: z.string().min(1).describe("User's current message"),
    fullContext: z.string().describe("Full context for LLM"),
    domain: z
      .string()
      .nullable()
      .describe("Business domain for search enrichment"),
    enableSearch: z.boolean().optional().default(false),
  }),

  outputSchema: z.object({
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

    const startTime = Date.now();

    try {
      let searchContext = "";
      let searchMetadata: any = {
        searchPerformed: false,
      };

      // ===== STEP 1: Execute Backend Searches (if enabled) =====
      if (inputData.enableSearch) {
        const searchStartTime = Date.now();

        // Enrich search queries with domain context
        const domainEnrichedQuery = inputData.domain
          ? `${inputData.domain} ${inputData.userMessage}`
          : inputData.userMessage;

        console.log(`🔍 Search query enrichment:`);
        console.log(`   - Original: "${inputData.userMessage}"`);
        console.log(`   - Domain: "${inputData.domain || "none"}"`);
        console.log(`   - Enriched: "${domainEnrichedQuery}"`);
        console.log(
          `   - Length: ${domainEnrichedQuery.length} chars (limit: 2048)`
        );

        // Execute BOTH searches in parallel with enriched queries
        const [businessResult, patternResult] = await Promise.allSettled([
          (businessDomainSearchTool as any).execute({
            context: { domain: domainEnrichedQuery },
            runtimeContext: {},
          }),
          (dbDesignPatternSearchTool as any).execute({
            context: { pattern: domainEnrichedQuery },
            runtimeContext: {},
          }),
        ]);

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
        }

        if (patternResult.status === "fulfilled" && patternResult.value) {
          const data = patternResult.value;
          patternSummary = await summarizeSearchResult(
            data.searchQuery,
            data.fullContent,
            "pattern"
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
      }

      // ===== STEP 4: Build Enhanced Message for LLM =====
      // Use fullContext (includes schema + history) for LLM, add search results if available
      const enhancedUserMessage = searchContext
        ? `${searchContext}\n\n${inputData.fullContext}`
        : inputData.fullContext;

      const outputSchema = erdInformationGenerationSchema.extend({
        explanation: z
          .string()
          .describe("Detailed explanation of the schema design decisions"),
      });

      const agentOptions: any = {
        instructions: schemaGenerationPrompt,
        // ✅ ENABLE STRUCTURED OUTPUT!
        // The output schema should match what the LLM generates (entities + explanation)
        output: outputSchema,
      };

      let result;
      try {
        result = await agent.generate(enhancedUserMessage, agentOptions);
      } catch (streamError) {
        throw streamError;
      }

      // ===== STEP 8: Extract Structured Response =====
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
        throw new Error("Agent response missing entities array");
      }

      const hasSchemaData = parsedResponse.entities.length > 0;

      console.log(`📊 Schema generation result:`);
      console.log(`   - Entities count: ${parsedResponse.entities.length}`);
      console.log(`   - Has schema data: ${hasSchemaData}`);
      if (parsedResponse.entities.length > 0) {
        console.log(
          `   - Entity names: ${parsedResponse.entities.map((e: any) => e.name).join(", ")}`
        );
        console.log(
          `   - Full entities:`,
          JSON.stringify(parsedResponse.entities, null, 2)
        );
      }

      // Note: DDL will be saved to thread metadata in the DDL generation step
      // This avoids duplicate storage and uses the more compact DDL format

      return {
        updatedSchema: { entities: parsedResponse.entities },
        agentResponse: parsedResponse.explanation,
        searchMetadata,
      };
    } catch (error) {
      throw new Error(
        `Schema generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export default schemaGenerationStep;
