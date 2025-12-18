import { Agent } from "@mastra/core/agent";
import { gemini25FlashLite } from "../models/google";

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
  condensedText: string; // Plain text summary
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
  searchType: "business" | "pattern" | "general"
): Promise<SummarizedSearchResult> {
  const originalWords = fullContent.split(/\s+/).filter(Boolean).length;

  // If content is small, skip summarization
  if (originalWords < 1000) {
    return {
      originalQuery: searchQuery,
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
      : searchType === "pattern"
        ? createPatternSummaryPrompt(searchQuery, fullContent)
        : createGeneralSummaryPrompt(searchQuery, fullContent);

  try {
    const result = await summarizerAgent.generate(prompt);
    const summary = result.text.trim();

    const summarizedWords = summary.split(/\s+/).filter(Boolean).length;
    const compressionRatio = summarizedWords / originalWords;

    console.log(
      `✅ Summarization complete: ${originalWords} → ${summarizedWords} words (${(compressionRatio * 100).toFixed(1)}%)`
    );

    return {
      originalQuery: searchQuery,
      condensedText: summary,
      originalWords,
      summarizedWords,
      compressionRatio,
    };
  } catch (error) {
    console.error("❌ Summarization failed:", error);

    // Improved Fallback: Extract meaningful snippets instead of blind truncation
    // Try to extract first paragraph from each search result
    const snippets: string[] = [];
    let snippetLength = 0;
    const MAX_FALLBACK_LENGTH = 2000;
    
    // Split by common search result separators
    const sections = fullContent.split(/\n\n---\n\n|\n## /);
    
    for (const section of sections) {
      if (snippetLength >= MAX_FALLBACK_LENGTH) break;
      
      // Extract first paragraph (up to first double newline or 300 chars)
      const firstParagraph = section.split("\n\n")[0].substring(0, 300);
      
      if (firstParagraph.length > 50) { // Skip very short snippets
        snippets.push(firstParagraph + "...");
        snippetLength += firstParagraph.length;
      }
    }
    
    const fallbackText = snippets.length > 0
      ? snippets.join("\n\n") + "\n\n[Summarization failed - showing snippets only]"
      : fullContent.substring(0, 2000) + "\n\n[Content truncated due to summarization failure]";

    return {
      originalQuery: searchQuery,
      condensedText: fallbackText,
      originalWords,
      summarizedWords: Math.ceil(fallbackText.split(/\s+/).length),
      compressionRatio: 0.1,
    };
  }
}

/**
 * Create prompt for business domain summarization - plain text output
 */
function createBusinessSummaryPrompt(query: string, content: string): string {
  return `You are analyzing business domain documentation for database schema design.

Search Query: "${query}"

Full Content:
${content}

Extract and summarize ONLY database-relevant information in plain text format. Write a concise summary covering:

1. Main entities/tables needed
2. Key relationships between entities
3. Important business rules affecting schema
4. Domain-specific best practices

Format as clear, concise paragraphs. Focus on actionable schema design insights.

Ignore marketing content, navigation, code examples in other languages, and general theory.

Keep the summary under 500 words while preserving all critical database design information.`;
}

/**
 * Create prompt for technical pattern summarization - plain text output
 */
function createPatternSummaryPrompt(query: string, content: string): string {
  return `You are analyzing technical database design pattern documentation.

Search Query: "${query}"

Full Content:
${content}

Extract and summarize ONLY actionable schema design information in plain text format. Write a concise summary covering:

1. SQL table structures and column definitions
2. Relationship modeling techniques
3. Performance considerations
4. Implementation guidelines and best practices
5. Common pitfalls to avoid

Format as clear, concise paragraphs. Focus on practical implementation details.

Ignore ORM code examples, programming language specifics, theoretical explanations without schema impact, and non-SQL database solutions.

Keep the summary under 500 words while preserving all critical technical details.`;
}

/**
 * Create prompt for general knowledge summarization - plain text output
 */
function createGeneralSummaryPrompt(query: string, content: string): string {
  return `You are analyzing database and SQL educational content.

Search Query: "${query}"

Full Content:
${content}

Extract and summarize the key information to answer the user's question. Write a concise summary covering:

1. Clear explanation of the concept or topic
2. Practical examples or use cases
3. Best practices and recommendations
4. Common pitfalls or misconceptions
5. Related concepts worth mentioning

Format as clear, concise paragraphs. Focus on educational value and practical understanding.

Ignore marketing content, navigation, unrelated topics, and overly technical implementation details.

Keep the summary under 500 words while preserving the most useful information.`;
}

/**
 * Format summarized search results into LLM-consumable context
 */
export function formatSummarizedContext(
  businessSummary: SummarizedSearchResult | null,
  patternSummary: SummarizedSearchResult | null,
  generalSummary?: SummarizedSearchResult | null
): string {
  if (!businessSummary && !patternSummary) {
    return "";
  }

  let context = "\n\n## 📚 Search Context (Summarized)\n\n";
  context +=
    "*The following information has been gathered and summarized to assist with your schema design:*\n\n";

  if (businessSummary) {
    context += "### 🏢 Business Domain Insights\n\n";
    context += businessSummary.condensedText + "\n\n";
    context += `*Compressed: ${businessSummary.originalWords.toLocaleString()} → ${businessSummary.summarizedWords.toLocaleString()} words (${(businessSummary.compressionRatio * 100).toFixed(0)}% of original)*\n\n`;
    context += "---\n\n";
  }

  if (patternSummary) {
    context += "### 🔧 Technical Pattern Guidance\n\n";
    context += patternSummary.condensedText + "\n\n";
    context += `*Compressed: ${patternSummary.originalWords.toLocaleString()} → ${patternSummary.summarizedWords.toLocaleString()} words (${(patternSummary.compressionRatio * 100).toFixed(0)}% of original)*\n\n`;
    context += "---\n\n";
  }

  if (generalSummary) {
    context += "### 📚 Database Knowledge\n\n";
    context += generalSummary.condensedText + "\n\n";
    context += `*Compressed: ${generalSummary.originalWords.toLocaleString()} → ${generalSummary.summarizedWords.toLocaleString()} words (${(generalSummary.compressionRatio * 100).toFixed(0)}% of original)*\n\n`;
    context += "---\n\n";
  }

  return context;
}
