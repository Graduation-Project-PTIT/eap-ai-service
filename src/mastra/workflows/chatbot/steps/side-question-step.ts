import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";
import generalKnowledgeSearchTool from "../../../tools/general-knowledge-search.tool";
import {
  SummarizedSearchResult,
  summarizeSearchResult,
} from "../../../utils/content-summarizer";
import { buildSideQuestionContext } from "../../../utils/context-utils";

/**
 * Side Question Handling Step
 *
 * This step handles general questions or off-topic queries.
 * It builds its own context from raw data and optionally enriches it with web search.
 *
 * Flow:
 * 1. Build context from raw schema and conversation history
 * 2. If enableSearch = true → Execute general knowledge search
 * 3. Summarize search results (80-90% compression)
 * 4. Prepend summarized search to context
 * 5. Generate response using the enhanced context
 */
const sideQuestionStep = createStep({
  id: "sideQuestionStep",

  inputSchema: z.object({
    userMessage: z.string().min(1).describe("The user's current message"),
    domain: z.string().nullable(),
    currentErdSchema: z.any().nullable(),
    currentPhysicalSchema: z.any().nullable(),
    currentDdl: z.string().nullable(),
    conversationHistory: z
      .array(
        z.object({
          role: z.string(),
          content: z.string(),
          createdAt: z.string().optional(),
        })
      )
      .optional(),
    intent: z.enum(["schema", "side-question"]),
    schemaIntent: z.enum(["create", "modify"]).nullable(),
    diagramType: z
      .enum(["ERD", "PHYSICAL_DB"])
      .nullable()
      .describe("Type of diagram to generate"),
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
    const {
      userMessage,
      currentErdSchema,
      currentDdl,
      conversationHistory,
      enableSearch,
    } = inputData;
    const agent = mastra.getAgent("sideQuestionAgent");

    // Build context from raw data
    const baseContext = buildSideQuestionContext({
      userMessage,
      erdSchema: currentErdSchema,
      ddl: currentDdl,
      conversationHistory: conversationHistory || [],
    });

    console.log(
      `💬 Handling side question (base context: ${baseContext.length} chars)`
    );

    try {
      let searchContext = "";
      let searchMetadata: {
        searchPerformed: boolean;
        searchTokens?: number;
        compressionRatio?: number;
      } = {
        searchPerformed: false,
      };

      // ===== STEP 1: Execute Web Search (if enabled) =====
      if (enableSearch) {
        console.log(
          `🔍 Executing general knowledge search for: "${userMessage}"`
        );

        try {
          const searchResult = await (
            generalKnowledgeSearchTool as any
          ).execute({
            context: { query: userMessage },
            runtimeContext: {},
          });

          if (searchResult) {
            // ===== STEP 2: Summarize Search Results =====
            const summary: SummarizedSearchResult = await summarizeSearchResult(
              searchResult.searchQuery,
              searchResult.fullContent,
              "general"
            );

            // ===== STEP 3: Format Summarized Context =====
            searchContext = `\n\n## 📚 Search Context (Summarized)\n\n`;
            searchContext += `*The following information has been gathered to help answer your question:*\n\n`;
            searchContext += `### 📖 General Knowledge\n\n`;
            searchContext += summary.condensedText + "\n\n";
            searchContext += `*Compressed: ${summary.originalWords.toLocaleString()} → ${summary.summarizedWords.toLocaleString()} words (${(summary.compressionRatio * 100).toFixed(0)}% of original)*\n\n`;
            searchContext += "---\n\n";

            searchMetadata = {
              searchPerformed: true,
              searchTokens: Math.ceil(summary.summarizedWords * 0.75),
              compressionRatio: summary.compressionRatio,
            };

            console.log(
              `✅ Search completed: ${summary.originalWords} → ${summary.summarizedWords} words`
            );
          }
        } catch (searchError) {
          console.warn(
            "⚠️ Search failed, continuing without search context:",
            searchError
          );
        }
      }

      // ===== STEP 4: Build Enhanced Context =====
      const enhancedContext = searchContext
        ? `${searchContext}${baseContext}`
        : baseContext;

      console.log(
        `💬 Answering side question (context: ${enhancedContext.length} chars)`
      );

      // Generate response using enhanced context
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
