import { createTool } from "@mastra/core";
import { z } from "zod";
import axios from "axios";

/**
 * Business Domain Search Tool
 *
 * Searches for BUSINESS REQUIREMENTS and DOMAIN CONCEPTS to understand
 * what entities and workflows are needed in a specific business domain.
 *
 * Use this FIRST when designing a schema for:
 * - Healthcare/Medical systems
 * - E-commerce/Retail platforms
 * - Education/School management
 * - Financial/Banking systems
 * - Any industry-specific domain you're not 100% familiar with
 *
 * This tool helps you discover:
 * - What entities (tables) typically exist in this domain
 * - What business workflows and processes are involved
 * - What relationships exist between business concepts
 * - Domain-specific terminology and vocabulary
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

export const businessDomainSearchTool = createTool({
  id: "business-domain-search-tool",
  description: `Search for BUSINESS REQUIREMENTS and DOMAIN ENTITIES for a specific industry or domain.

Use this tool when:
- User asks for a schema in an unfamiliar business domain (healthcare, e-commerce, logistics, etc.)
- You need to understand what entities/tables are typically needed in that domain
- You want to discover business workflows and processes
- You're not 100% confident about the domain's core entities

Examples of GOOD queries:
- "hospital management system core entities and business workflows"
- "e-commerce platform essential database entities"
- "school management system functional requirements entities"
- "banking system core business entities"

DO NOT use for:
- Simple CRUD apps (todo, blog)
- Technical database patterns (use db-design-pattern-search instead)
- When you already know the domain well`,

  inputSchema: z.object({
    domain: z
      .string()
      .min(3)
      .describe(
        "The business domain to search for (e.g., 'hospital management', 'e-commerce', 'school management')"
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
    const { domain } = context;
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
      console.warn("⚠️  SERPER_API_KEY not configured");
      throw new Error("Serper API key not configured");
    }

    // Create a business-focused search query
    const searchQuery = `${domain} system core entities business requirements database`;

    console.log(`🏢 Business domain search: "${searchQuery}"`);

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
      const summary = `Found ${formattedResults.length} resources about ${domain} business requirements. Key entities and concepts discovered from search results.`;

      console.log(
        `✅ Business search completed: ${formattedResults.length} results`
      );

      return {
        results: formattedResults,
        searchQuery,
        summary,
      };
    } catch (error) {
      console.error("❌ Business domain search failed:", error);
      throw new Error(
        `Business search failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

export default businessDomainSearchTool;
