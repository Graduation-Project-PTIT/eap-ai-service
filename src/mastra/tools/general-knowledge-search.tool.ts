import { createTool } from "@mastra/core";
import { z } from "zod";
import axios from "axios";
import {
  extractContentBatch,
  formatAsMarkdown,
  mergeResultsWithContent,
  generateExtractionSummary,
} from "../utils/content-extractor";

/**
 * General Knowledge Search Tool
 *
 * Searches for GENERAL DATABASE KNOWLEDGE and concept explanations
 * to help answer user questions about databases, SQL, and related topics.
 *
 * Use this when:
 * - User asks general questions about database concepts
 * - User needs explanation of SQL syntax or features
 * - User wants to understand best practices
 * - User has off-topic but database-related questions
 *
 * This tool helps provide:
 * - Clear explanations of database concepts
 * - SQL syntax and usage examples
 * - Best practices and recommendations
 * - General technical knowledge
 */

interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperApiResponse {
  organic?: SerperSearchResult[];
}

export const generalKnowledgeSearchTool = createTool({
  id: "general-knowledge-search-tool",
  description: `Search for GENERAL DATABASE KNOWLEDGE and concept explanations.

Use this tool when:
- User asks about database concepts (normalization, indexes, transactions, etc.)
- User needs SQL syntax explanations
- User wants to understand database best practices
- User has general technical questions

Examples of GOOD queries:
- "what is database normalization"
- "how do foreign keys work"
- "difference between inner join and outer join"
- "what is ACID in databases"
- "how to optimize SQL queries"

DO NOT use for:
- Specific business domain requirements (use business-domain-search instead)
- Complex design patterns (use db-design-pattern-search instead)`,

  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe("The user's question or topic to search for"),
  }),

  outputSchema: z.object({
    searchQuery: z.string(),
    summary: z.string(),
    fullContent: z
      .string()
      .describe(
        "Complete extracted content from all search results formatted as markdown"
      ),
    metadata: z.object({
      totalResults: z.number(),
      successfulExtractions: z.number(),
      totalWords: z.number(),
    }),
  }),

  execute: async ({ context }) => {
    const { query } = context;
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
      console.warn("⚠️  SERPER_API_KEY not configured");
      throw new Error("Serper API key not configured");
    }

    // Create a general knowledge-focused search query
    const searchQuery = `${query} database SQL explanation best practices`;

    console.log(`📚 General knowledge search: "${searchQuery}"`);

    try {
      const response = await axios.post<SerperApiResponse>(
        "https://google.serper.dev/search",
        {
          q: searchQuery,
          num: 5,
        },
        {
          headers: {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      const organicResults = response.data.organic || [];
      const formattedResults = organicResults.map((result) => ({
        title: result.title,
        snippet: result.snippet,
        link: result.link,
      }));

      console.log(
        `✅ General search completed: ${formattedResults.length} results. Extracting full content...`
      );

      // Phase 2: Extract full content from all URLs
      const urls = formattedResults.map((r) => r.link);
      const extractedContents = await extractContentBatch(urls);

      // Merge search results with extracted content
      const enhancedResults = mergeResultsWithContent(
        formattedResults,
        extractedContents
      );

      // Format as markdown for LLM consumption
      const fullContent = formatAsMarkdown(searchQuery, enhancedResults);

      // Generate summary
      const summary = generateExtractionSummary(enhancedResults);

      const successfulExtractions = enhancedResults.filter(
        (r) => r.extractionStatus === "success"
      ).length;
      const totalWords = enhancedResults.reduce(
        (sum, r) => sum + (r.wordCount || 0),
        0
      );

      console.log(`✅ Content extraction completed: ${summary}`);

      return {
        searchQuery,
        summary,
        fullContent,
        metadata: {
          totalResults: formattedResults.length,
          successfulExtractions,
          totalWords,
        },
      };
    } catch (error) {
      console.error("❌ General knowledge search failed:", error);
      throw new Error(
        `General search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

export default generalKnowledgeSearchTool;
