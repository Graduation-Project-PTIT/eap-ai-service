import { createStep, MastraStorage } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../../schemas/dbInformationGenerationSchema";
import businessDomainSearchTool from "../../../../tools/business-domain-search.tool";
import dbDesignPatternSearchTool from "../../../../tools/db-design-pattern-search.tool";
import {
  SummarizedSearchResult,
  summarizeSearchResult,
  formatSummarizedContext,
} from "../../../../utils/content-summarizer";

/**
 * Conversational Schema Step
 *
 * Flow:
 * 1. If enableSearch = true → Execute searches in parallel
 * 2. Summarize full content (80-90% compression)
 * 3. Build messages array with context (schema, search, history, request)
 * 4. Pass messages to agent
 * 5. LLM returns structured output (Zod validated)
 */
const schemaGenerationStep = createStep({
  id: "schemaGenerationStep",

  inputSchema: z.object({
    userMessage: z.string().min(1).describe("User's current message"),
    fullContext: z.string().describe("Full context for LLM (legacy, for fallback)"),
    schemaContext: z
      .string()
      .nullable()
      .describe("Current DDL schema if exists"),
    conversationHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
      .optional()
      .describe("Previous conversation messages"),
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

      // ===== STEP 4: Build Messages Array =====
      // Send context as separate user messages in the order the prompt expects:
      // 1. Current Schema
      // 2. Search Context
      // 3. Conversation History
      // 4. User Request
      
      const messages: any[] = [];

      // Message 1: Current Schema (if exists)
      if (inputData.schemaContext) {
        messages.push({
          role: "user",
          content: `[CONTEXT] Current Database Schema (MODIFICATION MODE)\n\`\`\`sql\n${inputData.schemaContext}\n\`\`\``,
        });
      } else {
        messages.push({
          role: "user",
          content: "[CONTEXT] Current Database Schema\nNone (CREATE mode)",
        });
      }

      // Message 2: Search Context (if available)
      if (searchContext) {
        messages.push({
          role: "user",
          content: `[CONTEXT] Search Results\n\n${searchContext}`,
        });
      } else {
        messages.push({
          role: "user",
          content: "[CONTEXT] Search Results\nNo search performed",
        });
      }

      // Message 3: Conversation History (with token-based truncation)
      if (inputData.conversationHistory?.length) {
        const MAX_HISTORY_TOKENS = 3000; // Limit history to 3K tokens
        const calculateTokens = (text: string) => Math.ceil(text.length / 4);
        
        let truncatedHistory: typeof inputData.conversationHistory = [];
        let historyTokenCount = 0;
        
        // Process messages in reverse (most recent first) to keep recent context
        for (let i = inputData.conversationHistory.length - 1; i >= 0; i--) {
          const msg = inputData.conversationHistory[i];
          const msgTokens = calculateTokens(msg.content);
          
          if (historyTokenCount + msgTokens <= MAX_HISTORY_TOKENS) {
            truncatedHistory.unshift(msg); // Add to front
            historyTokenCount += msgTokens;
          } else {
            console.log(`✂️  Truncated ${inputData.conversationHistory.length - truncatedHistory.length} old messages (would exceed ${MAX_HISTORY_TOKENS} tokens)`);
            break;
          }
        }
        
        const formattedHistory = truncatedHistory
          .map(
            (msg) =>
              `**${msg.role === "user" ? "User" : "Assistant"}**: ${msg.content}`
          )
          .join("\n\n");
        
        messages.push({
          role: "user",
          content: `[CONTEXT] Conversation History\n\n${formattedHistory}`,
        });
      } else {
        messages.push({
          role: "user",
          content: "[CONTEXT] Conversation History\nNo previous messages",
        });
      }

      // Message 4: User Request (with priority marker)
      messages.push({
        role: "user",
        content: `[CRITICAL] Current Request\n\n${inputData.userMessage}`,
      });

      // ===== PHASE 3: Token Counting & Monitoring =====
      const calculateTokens = (text: string) => Math.ceil(text.length / 4);
      
      const tokenBreakdown = {
        schemaTokens: calculateTokens(messages[0].content),
        searchTokens: calculateTokens(messages[1].content),
        historyTokens: calculateTokens(messages[2].content),
        requestTokens: calculateTokens(messages[3].content),
      };

      const totalInputTokens = Object.values(tokenBreakdown).reduce((a, b) => a + b, 0);
      const systemPromptTokens = Math.ceil(8987 / 4);
      const grandTotalTokens = totalInputTokens + systemPromptTokens;

      // Concise token log
      console.log(`📊 Tokens: ${grandTotalTokens.toLocaleString()} total (${tokenBreakdown.schemaTokens}+${tokenBreakdown.searchTokens}+${tokenBreakdown.historyTokens}+${tokenBreakdown.requestTokens}+${systemPromptTokens})`);
      
      // Warnings only
      if (grandTotalTokens > 15000) {
        console.error(`🚨 CRITICAL: Very high token usage (${grandTotalTokens} tokens)`);
      } else if (grandTotalTokens > 8000) {
        console.warn(`⚠️  WARNING: High token usage (${grandTotalTokens} tokens)`);
      }

      // ===== STEP 5: Call Agent with Messages Array =====
      const outputSchema = erdInformationGenerationSchema.extend({
        explanation: z
          .string()
          .describe("Detailed explanation of the schema design decisions"),
      });

      // NOTE: Do NOT override instructions - agent already has the prompt
      // Just pass messages and output schema
      let result;
      try {
        result = await agent.generate(messages, {
          output: outputSchema,
        });
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

      if (!parsedResponse.entities || !Array.isArray(parsedResponse.entities)) {
        throw new Error("Agent response missing entities array");
      }

      const hasSchemaData = parsedResponse.entities.length > 0;
      console.log(`✅ Generated ${parsedResponse.entities.length} entities`);

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
