import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";
import generalKnowledgeSearchTool from "../../../tools/general-knowledge-search.tool";
import {
  summarizeSearchResult,
  formatSummarizedContext,
} from "../../../utils/content-summarizer";

/**
 * Side Question Handling Step
 *
 * This step handles general questions or off-topic queries.
 * It uses the side question agent to provide helpful responses
 * without memory (context is provided manually).
 *
 * Flow:
 * 1. If enableSearch = true → Execute general knowledge search
 * 2. Summarize full content (80-90% compression)
 * 3. Pass summarized context + user message to LLM
 * 4. Return response with search metadata
 */
const sideQuestionStep = createStep({
  id: "sideQuestionStep",

  inputSchema: z.object({
    userMessage: z.string().min(1).describe("The user's current message"),
    fullContext: z.string().describe("Full context including schema + history"),
    domain: z.string().nullable(),
    schemaContext: z.string().nullable(),
    conversationHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
      .optional(),
    intent: z.enum(["schema", "side-question"]),
    schemaIntent: z.enum(["create", "modify"]).nullable(),
    confidence: z.number(),
    enableSearch: z.boolean().optional().default(true),
  }),

  outputSchema: z.object({
    response: z.string().describe("The assistant's response"),
    updatedSchema: erdInformationGenerationSchema.optional(),
    ddlScript: z.string().optional(),
    agentResponse: z.string().optional(),
    isSideQuestion: z.boolean(),
    isSchemaGeneration: z.boolean(),
    searchMetadata: z
      .object({
        searchPerformed: z.boolean(),
        searchTokens: z.number().optional(),
        compressionRatio: z.number().optional(),
      })
      .optional(),
  }),

  execute: async ({ inputData, mastra }) => {
    const { fullContext, userMessage, enableSearch } = inputData;
    const agent = mastra.getAgent("sideQuestionAgent");

    console.log(
      `💬 Handling side question with full context (${fullContext.length} chars)`
    );

    try {
      let searchContext = "";
      let searchMetadata: any = {
        searchPerformed: false,
      };

      // ===== STEP 1: Execute Web Search (if enabled) =====
      if (enableSearch) {
        console.log(`🔍 Searching for: "${userMessage}"`);

        try {
          const searchResult = await (generalKnowledgeSearchTool as any).execute({
            context: { query: userMessage },
            runtimeContext: {},
          });

          if (searchResult) {
            // ===== STEP 2: Summarize Search Results =====
            const generalSummary = await summarizeSearchResult(
              searchResult.searchQuery,
              searchResult.fullContent,
              "general"
            );

            // ===== STEP 3: Format Summarized Context =====
            searchContext = formatSummarizedContext(null, null, generalSummary);

            // Calculate metadata
            searchMetadata = {
              searchPerformed: true,
              searchTokens: Math.ceil(generalSummary.summarizedWords * 0.75),
              compressionRatio: generalSummary.compressionRatio,
            };

            console.log(
              `✅ Search completed: ${generalSummary.originalWords} → ${generalSummary.summarizedWords} words`
            );
          }
        } catch (searchError) {
          console.warn("⚠️ Search failed, continuing without search context:", searchError);
          // Continue without search - not a fatal error
        }
      }

      // ===== STEP 4: Build Enhanced Message for LLM =====
      const enhancedContext = searchContext
        ? `${searchContext}\n\n${fullContext}`
        : fullContext;

      // ===== STEP 5: Generate Response =====
      console.log(`💬 Answering side question`);

      const result = await agent.generate(enhancedContext);
      const response = result.text;

      console.log(`✅ Side question answered (${response.length} chars)`);

      return {
        response,
        updatedSchema: undefined,
        ddlScript: undefined,
        agentResponse: undefined,
        isSideQuestion: true,
        isSchemaGeneration: false,
        searchMetadata,
      };
    } catch (error) {
      console.error("❌ Side question handling error:", error);

      // Return a friendly error message
      return {
        response:
          "I apologize, but I encountered an error while processing your question. Please try again or rephrase your question.",
        updatedSchema: undefined,
        ddlScript: undefined,
        agentResponse: undefined,
        isSideQuestion: true,
        isSchemaGeneration: false,
        searchMetadata: { searchPerformed: false },
      };
    }
  },
});

export default sideQuestionStep;
