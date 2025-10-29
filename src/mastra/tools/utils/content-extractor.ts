import axios from "axios";

/**
 * Content Extractor Utilities
 *
 * Provides functionality to extract full webpage content using Jina Reader API
 * and format results for optimal LLM consumption.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ExtractedContent {
  url: string;
  markdown: string;
  wordCount: number;
  success: boolean;
  error?: string;
}

export interface EnhancedSearchResult {
  title: string;
  url: string;
  snippet: string;
  fullContent?: string;
  wordCount?: number;
  extractionStatus: "success" | "failed" | "skipped";
}

// ============================================================================
// CONSTANTS
// ============================================================================

const JINA_READER_BASE_URL = "https://r.jina.ai";
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_CONTENT_LENGTH = 50000; // 50K characters max

// ============================================================================
// CORE EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract content from a single URL using Jina Reader API
 *
 * @param url - The URL to extract content from
 * @returns Extracted content with metadata
 */
export async function extractContentWithJina(
  url: string
): Promise<ExtractedContent> {
  try {
    console.log(`🔍 Extracting content from: ${url}`);

    const response = await axios.get(`${JINA_READER_BASE_URL}/${url}`, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        Accept: "text/plain",
        "User-Agent": "Mozilla/5.0 (compatible; EAP-AI-Service/1.0)",
      },
      maxContentLength: MAX_CONTENT_LENGTH * 2, // Allow some buffer
    });

    let markdown = response.data;

    // Truncate if too long
    if (markdown.length > MAX_CONTENT_LENGTH) {
      console.warn(
        `⚠️  Content truncated from ${markdown.length} to ${MAX_CONTENT_LENGTH} chars`
      );
      markdown = markdown.substring(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]";
    }

    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    console.log(`✅ Extracted ${wordCount} words from ${url}`);

    return {
      url,
      markdown,
      wordCount,
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Failed to extract content from ${url}:`, errorMessage);

    return {
      url,
      markdown: "",
      wordCount: 0,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract content from multiple URLs in parallel with error handling
 *
 * Uses Promise.allSettled to ensure one failure doesn't break everything
 *
 * @param urls - Array of URLs to extract content from
 * @returns Array of extraction results
 */
export async function extractContentBatch(
  urls: string[]
): Promise<ExtractedContent[]> {
  console.log(`📦 Batch extracting content from ${urls.length} URLs`);

  const extractionPromises = urls.map((url) => extractContentWithJina(url));

  const results = await Promise.allSettled(extractionPromises);

  const extractedContents: ExtractedContent[] = results.map(
    (result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          url: urls[index],
          markdown: "",
          wordCount: 0,
          success: false,
          error: result.reason?.message || "Extraction failed",
        };
      }
    }
  );

  const successCount = extractedContents.filter((r) => r.success).length;
  console.log(
    `✅ Batch extraction completed: ${successCount}/${urls.length} successful`
  );

  return extractedContents;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format search results into structured markdown for LLM consumption
 *
 * Creates a well-structured document with source citations and metadata
 *
 * @param query - The original search query
 * @param results - Enhanced search results with extracted content
 * @returns Formatted markdown string
 */
export function formatAsMarkdown(
  query: string,
  results: EnhancedSearchResult[]
): string {
  const successfulExtractions = results.filter(
    (r) => r.extractionStatus === "success"
  ).length;
  const totalWords = results.reduce((sum, r) => sum + (r.wordCount || 0), 0);

  let markdown = `# Search Results: "${query}"\n\n`;
  markdown += `*Found ${results.length} sources, extracted full content from ${successfulExtractions} pages (~${totalWords.toLocaleString()} total words)*\n\n`;
  markdown += `---\n\n`;

  results.forEach((result, index) => {
    markdown += `## 📄 Source ${index + 1}: ${result.title}\n`;
    markdown += `**URL**: ${result.url}\n`;
    markdown += `**Snippet**: ${result.snippet}\n`;

    if (result.extractionStatus === "success" && result.fullContent) {
      markdown += `**Content Length**: ${result.wordCount?.toLocaleString()} words\n\n`;
      markdown += `### Full Content:\n`;
      markdown += `${result.fullContent}\n\n`;
    } else {
      markdown += `**Status**: Content extraction ${result.extractionStatus}\n\n`;
      markdown += `### Snippet Only:\n`;
      markdown += `${result.snippet}\n\n`;
    }

    markdown += `---\n\n`;
  });

  return markdown;
}

/**
 * Merge search results with extracted content
 *
 * Combines Serper search results with Jina-extracted content
 *
 * @param searchResults - Original search results from Serper
 * @param extractedContents - Extracted content from Jina
 * @returns Enhanced search results
 */
export function mergeResultsWithContent(
  searchResults: Array<{ title: string; link: string; snippet: string }>,
  extractedContents: ExtractedContent[]
): EnhancedSearchResult[] {
  return searchResults.map((result, index) => {
    const extracted = extractedContents[index];

    if (extracted && extracted.success) {
      return {
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        fullContent: extracted.markdown,
        wordCount: extracted.wordCount,
        extractionStatus: "success",
      };
    } else {
      return {
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        fullContent: undefined,
        wordCount: 0,
        extractionStatus: "failed",
      };
    }
  });
}

/**
 * Generate a summary of extraction results
 *
 * @param results - Enhanced search results
 * @returns Summary string
 */
export function generateExtractionSummary(
  results: EnhancedSearchResult[]
): string {
  const successful = results.filter(
    (r) => r.extractionStatus === "success"
  ).length;
  const failed = results.filter((r) => r.extractionStatus === "failed").length;
  const totalWords = results.reduce((sum, r) => sum + (r.wordCount || 0), 0);

  return `Found ${results.length} resources. Successfully extracted full content from ${successful} source(s) (~${totalWords.toLocaleString()} words total). ${failed > 0 ? `${failed} extraction(s) failed (using snippets).` : ""}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  extractContentWithJina,
  extractContentBatch,
  formatAsMarkdown,
  mergeResultsWithContent,
  generateExtractionSummary,
};
