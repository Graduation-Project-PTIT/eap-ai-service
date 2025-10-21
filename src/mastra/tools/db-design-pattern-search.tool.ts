import { createTool } from "@mastra/core";
import { z } from "zod";
import axios from "axios";

/**
 * Database Design Pattern Search Tool
 *
 * Searches for TECHNICAL DATABASE DESIGN PATTERNS and best practices
 * for implementing complex relationships and database structures.
 *
 * Use this AFTER you've identified entities, when you need help with:
 * - Many-to-many relationships
 * - Polymorphic associations
 * - Hierarchical data (trees, nested sets)
 * - Audit trails and versioning
 * - Soft deletes
 * - Multi-tenancy patterns
 * - Normalization strategies
 *
 * This tool helps you learn:
 * - How to model complex relationships correctly
 * - What columns/constraints are needed
 * - Best practices for specific patterns
 * - Performance considerations
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

export const dbDesignPatternSearchTool = createTool({
  id: "db-design-pattern-search-tool",
  description: `Search for TECHNICAL DATABASE DESIGN PATTERNS and implementation best practices.

Use this tool when:
- You need to model a complex relationship (many-to-many, polymorphic, hierarchical)
- You want to implement a specific pattern (audit trail, soft delete, versioning)
- You need guidance on normalization or denormalization
- You want to learn SQL best practices for a specific scenario

Examples of GOOD queries:
- "many-to-many relationship database design best practices"
- "polymorphic association database pattern"
- "hierarchical data database design nested sets"
- "audit trail database schema pattern"
- "soft delete database implementation"
- "multi-tenant database schema design"

DO NOT use for:
- Understanding business requirements (use business-domain-search instead)
- Simple foreign key relationships
- Basic one-to-many relationships`,

  inputSchema: z.object({
    pattern: z
      .string()
      .min(3)
      .describe(
        "The database pattern or problem to search for (e.g., 'many-to-many relationship', 'audit trail pattern', 'polymorphic association')"
      ),
  }),

  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        link: z.string(),
      })
    ),
    searchQuery: z.string(),
    summary: z.string(),
  }),

  execute: async ({ context }) => {
    const { pattern } = context;
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
      console.warn("⚠️  SERPER_API_KEY not configured");
      throw new Error("Serper API key not configured");
    }

    // Create a technical design-focused search query
    const searchQuery = `${pattern} database design pattern best practices SQL`;

    console.log(`🔧 Database pattern search: "${searchQuery}"`);

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

      // Create a summary of findings
      const summary = `Found ${formattedResults.length} resources about ${pattern}. Review the design patterns and best practices from the results.`;

      console.log(
        `✅ Pattern search completed: ${formattedResults.length} results`
      );

      return {
        results: formattedResults,
        searchQuery,
        summary,
      };
    } catch (error) {
      console.error("❌ Database pattern search failed:", error);
      throw new Error(
        `Pattern search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

export default dbDesignPatternSearchTool;
