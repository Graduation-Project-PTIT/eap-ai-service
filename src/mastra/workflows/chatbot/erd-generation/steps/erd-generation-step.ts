import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../../schemas/erdInformationGenerationSchema";
import businessDomainSearchTool from "../../../../tools/business-domain-search.tool";
import dbDesignPatternSearchTool from "../../../../tools/db-design-pattern-search.tool";
import erdGenerationPrompt from "../../../../agents/chatbot/erd-generation/prompts/erd-generation-prompt";
import {
  SummarizedSearchResult,
  summarizeSearchResult,
  formatSummarizedContext,
} from "../../../../utils/content-summarizer";

/**
 * ERD Generation Step
 *
 * Generates ERD schema in Chen notation.
 * Flow:
 * 1. If enableSearch = true → Execute searches in parallel
 * 2. Summarize full content (80-90% compression)
 * 3. Pass summarized context + user message to LLM
 * 4. LLM returns structured ERD output (Zod validated)
 */
const erdGenerationStep = createStep({
  id: "erdGenerationStep",

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
    updatedErdSchema: erdInformationGenerationSchema,
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
    const agent = mastra.getAgent("erdGenerationAgent");

    const startTime = Date.now();

    try {
      let searchContext = "";
      let searchMetadata: any = {
        searchPerformed: false,
      };

      // ===== STEP 1: Execute Backend Searches (if enabled) =====
      if (inputData.enableSearch) {
        const domainEnrichedQuery = inputData.domain
          ? `${inputData.domain} ${inputData.userMessage}`
          : inputData.userMessage;

        console.log(`🔍 ERD Search query enrichment:`);
        console.log(`   - Original: "${inputData.userMessage}"`);
        console.log(`   - Domain: "${inputData.domain || "none"}"`);
        console.log(`   - Enriched: "${domainEnrichedQuery}"`);

        // Execute BOTH searches in parallel
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
      const enhancedUserMessage = searchContext
        ? `${searchContext}\n\n${inputData.fullContext}`
        : inputData.fullContext;

      // ===== STEP 5: Call Agent with Structured Output =====
      const outputSchema = erdInformationGenerationSchema.extend({
        explanation: z
          .string()
          .describe("Detailed explanation of the ERD design decisions"),
      });

      const agentOptions: any = {
        instructions: erdGenerationPrompt,
        output: outputSchema,
      };

      const result = await agent.generate(enhancedUserMessage, agentOptions);

      // ===== STEP 6: Extract Structured Response =====
      const resultWithObject = result as any;

      if (!resultWithObject.object) {
        throw new Error("Agent failed to generate structured ERD response");
      }

      const parsedResponse = resultWithObject.object as {
        entities: any[];
        relationships: any[];
        explanation: string;
      };

      if (!parsedResponse.entities || !Array.isArray(parsedResponse.entities)) {
        throw new Error("Agent response missing entities array");
      }

      console.log(`📊 ERD generation result:`);
      console.log(`   - Entities count: ${parsedResponse.entities.length}`);
      console.log(`   - Relationships count: ${parsedResponse.relationships?.length || 0}`);

      return {
        updatedErdSchema: {
          entities: parsedResponse.entities,
          relationships: parsedResponse.relationships || [],
        },
        agentResponse: parsedResponse.explanation,
        searchMetadata,
      };
    } catch (error) {
      throw new Error(
        `ERD generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export default erdGenerationStep;

