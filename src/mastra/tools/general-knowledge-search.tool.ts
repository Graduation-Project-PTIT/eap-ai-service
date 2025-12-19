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
 * Searches for DATABASE CONCEPTS and GENERAL KNOWLEDGE to help answer
 * questions about database design, SQL, and related topics.
 *
 * Use this for side questions such as:
 * - "What is normalization?"
 * - "Explain foreign keys"
 * - "What are indexes used for?"
 * - "Difference between SQL and NoSQL"
 * - Any database-related conceptual questions
 *
 * This tool helps provide:
 * - Clear explanations of database concepts
 * - Best practices and recommendations
 * - Examples and use cases
 * - Comparisons between different approaches
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
  description: `Search for DATABASE CONCEPTS and GENERAL KNOWLEDGE to answer questions.

Use this tool when:
- User asks conceptual questions about databases (normalization, indexes, constraints, etc.)
- User needs explanations of SQL concepts or syntax
- User wants to understand best practices or trade-offs
- User asks about differences between database technologies

Examples of GOOD queries:
- "what is database normalization and why is it important"
- "foreign key constraints explained"
- "database indexing best practices"
- "SQL joins types explained"
- "difference between relational and document databases"

DO NOT use for:
- Schema design requests (use schema generation instead)
- Business domain-specific questions (use business-domain-search instead)
- Technical implementation patterns (use db-design-pattern-search instead)`,

  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe(
        "The question or concept to search for (e.g., 'what is database normalization', 'explain foreign keys')"
      ),
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

    // Create a knowledge-focused search query
    const searchQuery = `${query} database SQL explained`;

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
        `✅ Knowledge search completed: ${formattedResults.length} results. Extracting full content...`
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
        `Knowledge search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

export default generalKnowledgeSearchTool;
