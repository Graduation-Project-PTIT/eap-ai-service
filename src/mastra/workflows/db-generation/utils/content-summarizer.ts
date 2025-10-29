import { Agent } from "@mastra/core";
import { gemini25FlashLite } from "../../../models/google";

/**
 * Content Summarizer
 *
 * Summarizes full search results into token-efficient, schema-focused insights.
 * Target: 80-90% compression while preserving key database design information.
 */

// Create lightweight agent for summarization
const summarizerAgent = new Agent({
  name: "contentSummarizerAgent",
  instructions:
    "You are a specialized agent that extracts database-relevant information from search results.",
  model: gemini25FlashLite, // Fast & cheap model for summarization
});

export interface SummarizedSearchResult {
  originalQuery: string;
  keyPoints: string[];
  entities: string[];
  relationships: string[];
  recommendations: string[];
  condensedText: string;
  originalWords: number;
  summarizedWords: number;
  compressionRatio: number;
}

/**
 * Summarize search result content for schema design
 */
export async function summarizeSearchResult(
  searchQuery: string,
  fullContent: string,
  searchType: "business" | "pattern"
): Promise<SummarizedSearchResult> {
  const originalWords = fullContent.split(/\s+/).filter(Boolean).length;

  // If content is small, skip summarization
  if (originalWords < 1000) {
    return {
      originalQuery: searchQuery,
      keyPoints: [],
      entities: [],
      relationships: [],
      recommendations: [],
      condensedText: fullContent,
      originalWords,
      summarizedWords: originalWords,
      compressionRatio: 1.0,
    };
  }

  console.log(
    `🔄 Summarizing ${searchType} search result (${originalWords} words)...`
  );

  const prompt =
    searchType === "business"
      ? createBusinessSummaryPrompt(searchQuery, fullContent)
      : createPatternSummaryPrompt(searchQuery, fullContent);

  try {
    const result = await summarizerAgent.generate(prompt);

    const summary = result.text;

    // Try to parse as JSON
    let parsed: any;
    try {
      parsed = JSON.parse(summary);
    } catch {
      // Fallback: return raw summary
      const summarizedWords = summary.split(/\s+/).filter(Boolean).length;
      return {
        originalQuery: searchQuery,
        keyPoints: [],
        entities: [],
        relationships: [],
        recommendations: [],
        condensedText: summary,
        originalWords,
        summarizedWords,
        compressionRatio: summarizedWords / originalWords,
      };
    }

    const summarizedWords = JSON.stringify(parsed)
      .split(/\s+/)
      .filter(Boolean).length;
    const compressionRatio = summarizedWords / originalWords;

    console.log(
      `✅ Summarization complete: ${originalWords} → ${summarizedWords} words (${(compressionRatio * 100).toFixed(1)}%)`
    );

    return {
      originalQuery: searchQuery,
      keyPoints: parsed.keyPoints || [],
      entities: parsed.entities || [],
      relationships: parsed.relationships || [],
      recommendations: parsed.recommendations || [],
      condensedText: parsed.summary || summary,
      originalWords,
      summarizedWords,
      compressionRatio,
    };
  } catch (error) {
    console.error("❌ Summarization failed:", error);

    // Fallback: aggressive truncation
    const truncated = fullContent.substring(0, 2000);
    return {
      originalQuery: searchQuery,
      keyPoints: [],
      entities: [],
      relationships: [],
      recommendations: [],
      condensedText:
        truncated + "\n\n[Content truncated due to summarization failure]",
      originalWords,
      summarizedWords: 500,
      compressionRatio: 0.1,
    };
  }
}

/**
 * Create prompt for business domain summarization
 */
function createBusinessSummaryPrompt(query: string, content: string): string {
  return `You are analyzing business domain documentation for database schema design.

Search Query: "${query}"

Full Content:
${content}

Extract ONLY database-relevant information. Return a JSON object:

{
  "keyPoints": [
    "Most important insight 1",
    "Most important insight 2",
    "Most important insight 3"
  ],
  "entities": [
    "EntityName1: brief description",
    "EntityName2: brief description"
  ],
  "relationships": [
    "Entity1 relationship with Entity2",
    "Entity2 relationship with Entity3"
  ],
  "recommendations": [
    "Design recommendation 1",
    "Design recommendation 2"
  ],
  "summary": "2-3 sentence overview of key database design insights"
}

Focus on:
- Main entities (tables) needed
- Relationships between entities
- Business rules affecting schema design
- Domain-specific best practices

Ignore:
- Marketing content
- Navigation elements
- Code examples in other languages
- General theory without practical schema implications`;
}

/**
 * Create prompt for technical pattern summarization
 */
function createPatternSummaryPrompt(query: string, content: string): string {
  return `You are analyzing technical database design pattern documentation.

Search Query: "${query}"

Full Content:
${content}

Extract ONLY actionable schema design information. Return a JSON object:

{
  "keyPoints": [
    "Most important technical insight 1",
    "Most important technical insight 2",
    "Most important technical insight 3"
  ],
  "entities": [
    "TableName1: purpose and structure",
    "TableName2: purpose and structure"
  ],
  "relationships": [
    "How to implement relationship X",
    "Column structure for pattern Y"
  ],
  "recommendations": [
    "SQL best practice 1",
    "Implementation guideline 2"
  ],
  "summary": "2-3 sentence technical summary of the pattern implementation"
}

Focus on:
- SQL table structures
- Column definitions and constraints
- Relationship modeling techniques
- Performance considerations
- Common pitfalls to avoid

Ignore:
- ORM code examples
- Programming language specifics
- Theoretical explanations without schema impact
- Non-SQL database solutions`;
}

/**
 * Format summarized search results into LLM-consumable context
 */
export function formatSummarizedContext(
  businessSummary: SummarizedSearchResult | null,
  patternSummary: SummarizedSearchResult | null
): string {
  if (!businessSummary && !patternSummary) {
    return "";
  }

  let context = "\n\n## 📚 Search Context (Summarized)\n\n";
  context +=
    "*The following information has been gathered and summarized to assist with your schema design:*\n\n";

  if (businessSummary) {
    context += "### 🏢 Business Domain Insights\n\n";

    if (businessSummary.keyPoints.length > 0) {
      context += "**Key Points:**\n";
      businessSummary.keyPoints.forEach((point) => {
        context += `- ${point}\n`;
      });
      context += "\n";
    }

    if (businessSummary.entities.length > 0) {
      context += "**Suggested Entities:**\n";
      businessSummary.entities.forEach((entity) => {
        context += `- ${entity}\n`;
      });
      context += "\n";
    }

    if (businessSummary.relationships.length > 0) {
      context += "**Relationships:**\n";
      businessSummary.relationships.forEach((rel) => {
        context += `- ${rel}\n`;
      });
      context += "\n";
    }

    if (businessSummary.recommendations.length > 0) {
      context += "**Recommendations:**\n";
      businessSummary.recommendations.forEach((rec) => {
        context += `- ${rec}\n`;
      });
      context += "\n";
    }

    context += `**Summary:** ${businessSummary.condensedText}\n\n`;
    context += `*Compressed: ${businessSummary.originalWords.toLocaleString()} → ${businessSummary.summarizedWords.toLocaleString()} words (${(businessSummary.compressionRatio * 100).toFixed(0)}% of original)*\n\n`;
    context += "---\n\n";
  }

  if (patternSummary) {
    context += "### 🔧 Technical Pattern Guidance\n\n";

    if (patternSummary.keyPoints.length > 0) {
      context += "**Key Points:**\n";
      patternSummary.keyPoints.forEach((point) => {
        context += `- ${point}\n`;
      });
      context += "\n";
    }

    if (patternSummary.entities.length > 0) {
      context += "**Required Tables:**\n";
      patternSummary.entities.forEach((entity) => {
        context += `- ${entity}\n`;
      });
      context += "\n";
    }

    if (patternSummary.relationships.length > 0) {
      context += "**Implementation Details:**\n";
      patternSummary.relationships.forEach((rel) => {
        context += `- ${rel}\n`;
      });
      context += "\n";
    }

    if (patternSummary.recommendations.length > 0) {
      context += "**Best Practices:**\n";
      patternSummary.recommendations.forEach((rec) => {
        context += `- ${rec}\n`;
      });
      context += "\n";
    }

    context += `**Summary:** ${patternSummary.condensedText}\n\n`;
    context += `*Compressed: ${patternSummary.originalWords.toLocaleString()} → ${patternSummary.summarizedWords.toLocaleString()} words (${(patternSummary.compressionRatio * 100).toFixed(0)}% of original)*\n\n`;
    context += "---\n\n";
  }

  return context;
}
