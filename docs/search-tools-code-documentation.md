# Web Search Tools - Comprehensive Code Documentation

This document provides an in-depth technical explanation of the web searching functionality in the EAP AI Service chatbot. It covers every code component from initial search execution through content extraction to final summarization, with practical examples using realistic data.

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Search Tool Implementation](#search-tool-implementation)
   - [Tool Structure and Configuration](#tool-structure-and-configuration)
   - [Input Schema Definition](#input-schema-definition)
   - [Output Schema Definition](#output-schema-definition)
   - [Execution Logic](#execution-logic)
3. [Content Extraction Pipeline](#content-extraction-pipeline)
   - [Single URL Extraction](#single-url-extraction)
   - [Batch Extraction](#batch-extraction)
   - [Result Merging](#result-merging)
   - [Markdown Formatting](#markdown-formatting)
4. [Content Summarization](#content-summarization)
   - [Summarizer Agent Configuration](#summarizer-agent-configuration)
   - [Prompt Engineering](#prompt-engineering)
   - [Compression Logic](#compression-logic)
5. [Complete Flow Example](#complete-flow-example)
6. [Integration with Workflow Steps](#integration-with-workflow-steps)

---

## System Architecture Overview

The web search system follows a three-phase pipeline architecture. In the first phase, the system performs a web search using the Serper API (a Google Search wrapper). In the second phase, it extracts full content from the discovered URLs using the Jina Reader API. In the third phase, it summarizes the extracted content using a lightweight LLM to compress information while preserving relevance.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Search Phase   │────▶│ Extraction Phase │────▶│ Summary Phase   │
│  (Serper API)   │     │  (Jina Reader)   │     │  (Gemini LLM)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   5 search results      Full markdown content     ~500 word summary
   with snippets         from each page            (80-90% compression)
```

---

## Search Tool Implementation

### Tool Structure and Configuration

All three search tools (General Knowledge, Business Domain, and DB Design Pattern) share identical structure. Here is the complete code for the General Knowledge Search Tool with detailed annotations:

```typescript
import { createTool } from "@mastra/core";
import { z } from "zod";
import axios from "axios";
import {
  extractContentBatch,
  formatAsMarkdown,
  mergeResultsWithContent,
  generateExtractionSummary,
} from "../utils/content-extractor";
```

The imports establish dependencies on the Mastra framework for tool creation, Zod for runtime schema validation, Axios for HTTP requests, and custom utility functions for content processing.

```typescript
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

DO NOT use for:
- Specific business domain requirements (use business-domain-search instead)
- Complex design patterns (use db-design-pattern-search instead)`,
```

The `createTool` function from Mastra creates an executable tool that can be invoked by LLM agents. The `id` field provides a unique identifier for tool selection. The `description` field is critical because LLM agents use this text to decide when to invoke the tool. The examples help the agent understand appropriate use cases.

### Input Schema Definition

```typescript
  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe("The user's question or topic to search for"),
  }),
```

The input schema uses Zod to define and validate incoming parameters. The `query` field must be a string with at least 3 characters. The `.describe()` method provides documentation that helps LLM agents understand what data to provide.

**Practical Example - Valid Input:**
```json
{
  "query": "what is database normalization third normal form"
}
```

**Practical Example - Invalid Input (would throw validation error):**
```json
{
  "query": "hi"
}
```

The validation error would state: "String must contain at least 3 character(s)"

### Output Schema Definition

```typescript
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
```

The output schema defines the structure of data returned after execution. Each field has a specific purpose:

- `searchQuery`: The enhanced query actually sent to Serper (differs from input query)
- `summary`: Human-readable extraction statistics
- `fullContent`: Complete markdown document with all extracted content
- `metadata`: Numeric statistics for monitoring and debugging

**Practical Example - Complete Output:**
```json
{
  "searchQuery": "what is database normalization third normal form database SQL explanation best practices",
  "summary": "Found 5 resources. Successfully extracted full content from 4 source(s) (~12,500 words total). 1 extraction(s) failed (using snippets).",
  "fullContent": "# Search Results: \"what is database normalization...\"\n\n*Found 5 sources, extracted full content from 4 pages (~12,500 total words)*\n\n---\n\n## 📄 Source 1: Database Normalization Explained...",
  "metadata": {
    "totalResults": 5,
    "successfulExtractions": 4,
    "totalWords": 12500
  }
}
```

### Execution Logic

```typescript
  execute: async ({ context }) => {
    const { query } = context;
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
      console.warn("⚠️  SERPER_API_KEY not configured");
      throw new Error("Serper API key not configured");
    }
```

The execute function is the core logic that runs when the tool is invoked. It first extracts the query from the context object and retrieves the API key from environment variables. If the API key is missing, execution halts with an error.

```typescript
    // Create a general knowledge-focused search query
    const searchQuery = `${query} database SQL explanation best practices`;

    console.log(`📚 General knowledge search: "${searchQuery}"`);
```

The query enhancement is a critical step. By appending "database SQL explanation best practices", the tool biases Google results toward educational, explanatory content rather than commercial or unrelated material.

**Query Enhancement Examples by Tool Type:**

| Tool | Original Query | Enhanced Query |
|------|---------------|----------------|
| General Knowledge | "what is normalization" | "what is normalization database SQL explanation best practices" |
| Business Domain | "hospital management" | "hospital management system core entities business requirements database" |
| DB Design Pattern | "many-to-many relationship" | "many-to-many relationship database design pattern best practices SQL" |

```typescript
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
```

The Serper API call uses POST method with the search query in the request body. The `num: 5` parameter limits results to 5 organic listings, balancing comprehensiveness with processing time and token consumption. A 10-second timeout prevents hanging on slow responses.

**Practical Example - Serper API Request:**
```http
POST https://google.serper.dev/search
X-API-KEY: your-api-key-here
Content-Type: application/json

{
  "q": "what is database normalization third normal form database SQL explanation best practices",
  "num": 5
}
```

**Practical Example - Serper API Response:**
```json
{
  "organic": [
    {
      "title": "Database Normalization Explained: 1NF, 2NF, 3NF, BCNF",
      "link": "https://www.guru99.com/database-normalization.html",
      "snippet": "Database normalization is the process of organizing data to minimize redundancy. 3NF requires that every non-key attribute depends only on the primary key...",
      "position": 1
    },
    {
      "title": "What is Third Normal Form (3NF)? - Database Guide",
      "link": "https://www.databaseguide.com/third-normal-form/",
      "snippet": "Third Normal Form (3NF) is achieved when a table is in 2NF and no transitive dependencies exist between non-key attributes...",
      "position": 2
    },
    {
      "title": "Database Normalization Tutorial - GeeksforGeeks",
      "link": "https://www.geeksforgeeks.org/database-normalization/",
      "snippet": "Normalization is the process of organizing data in a database. This includes creating tables and establishing relationships...",
      "position": 3
    },
    {
      "title": "SQL Normalization: 1NF, 2NF, 3NF and 4NF - SQL Tutorial",
      "link": "https://www.sqltutorial.org/sql-normalization/",
      "snippet": "SQL normalization is a database design technique that reduces data redundancy and eliminates undesirable characteristics...",
      "position": 4
    },
    {
      "title": "Understanding Database Normalization - Microsoft Learn",
      "link": "https://learn.microsoft.com/en-us/database/normalization",
      "snippet": "Normalization is used to organize a database into tables and columns. The main idea is that each table should be about one specific topic...",
      "position": 5
    }
  ]
}
```

```typescript
      const organicResults = response.data.organic || [];
      const formattedResults = organicResults.map((result) => ({
        title: result.title,
        snippet: result.snippet,
        link: result.link,
      }));

      console.log(
        `✅ General search completed: ${formattedResults.length} results. Extracting full content...`
      );
```

The code extracts organic search results and transforms them into a simplified structure containing only title, snippet, and link. This normalization ensures consistent data structure for subsequent processing.

**Practical Example - Formatted Results Array:**
```json
[
  {
    "title": "Database Normalization Explained: 1NF, 2NF, 3NF, BCNF",
    "snippet": "Database normalization is the process of organizing data to minimize redundancy...",
    "link": "https://www.guru99.com/database-normalization.html"
  },
  {
    "title": "What is Third Normal Form (3NF)? - Database Guide",
    "snippet": "Third Normal Form (3NF) is achieved when a table is in 2NF...",
    "link": "https://www.databaseguide.com/third-normal-form/"
  }
  // ... 3 more results
]
```

```typescript
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
```

The remaining execution logic invokes utility functions to extract content, merge results, and format output. Each function is explained in detail in the following sections.

---

## Content Extraction Pipeline

### Single URL Extraction

The `extractContentWithJina` function handles extraction from individual URLs:

```typescript
const JINA_READER_BASE_URL = "https://r.jina.ai";
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_CONTENT_LENGTH = 50000; // 50K characters max

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
      maxContentLength: MAX_CONTENT_LENGTH * 2,
    });
```

The Jina Reader API works by prepending `https://r.jina.ai/` to any URL. Jina's service fetches the page, parses it, and returns clean markdown text. The function sets a 10-second timeout and accepts plain text responses.

**Practical Example - Jina API Request:**
```http
GET https://r.jina.ai/https://www.guru99.com/database-normalization.html
Accept: text/plain
User-Agent: Mozilla/5.0 (compatible; EAP-AI-Service/1.0)
```

**Practical Example - Jina API Response (truncated):**
```markdown
# Database Normalization Explained: 1NF, 2NF, 3NF, BCNF Examples

## What is Normalization?

Normalization is a database design technique that organizes tables in a manner that reduces redundancy and dependency of data. It divides larger tables into smaller tables and links them using relationships.

## Why is Normalization Important?

Normalization helps to:
- Eliminate redundant data (storing the same data in multiple tables)
- Ensure data dependencies make sense (only storing related data in a table)

## Types of Normal Forms

### First Normal Form (1NF)
A table is in 1NF if:
- It contains only atomic (indivisible) values
- There are no repeating groups or arrays

**Example:**

| StudentID | Name | Courses |
|-----------|------|---------|
| 1 | John | Math, Physics |

This violates 1NF because Courses contains multiple values...

### Second Normal Form (2NF)
A table is in 2NF if:
- It is in 1NF
- All non-key attributes are fully functionally dependent on the primary key

### Third Normal Form (3NF)
A table is in 3NF if:
- It is in 2NF
- There are no transitive dependencies

**Transitive dependency** occurs when a non-key column depends on another non-key column...

[Content continues for approximately 2000 more words]
```

```typescript
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
```

Content exceeding 50,000 characters is truncated to prevent excessive token consumption. The word count is calculated by splitting on whitespace and filtering empty strings.

**Practical Example - Successful Extraction Result:**
```json
{
  "url": "https://www.guru99.com/database-normalization.html",
  "markdown": "# Database Normalization Explained...\n\n## What is Normalization?\n\nNormalization is a database design technique...\n\n[full content here, ~2500 words]",
  "wordCount": 2500,
  "success": true
}
```

```typescript
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
```

Failed extractions return a structured error result rather than throwing. This allows the system to gracefully handle partial failures without losing successful extractions.

**Practical Example - Failed Extraction Result:**
```json
{
  "url": "https://example.com/page-that-blocks-crawlers",
  "markdown": "",
  "wordCount": 0,
  "success": false,
  "error": "Request failed with status code 403"
}
```

### Batch Extraction

The `extractContentBatch` function processes multiple URLs in parallel:

```typescript
export async function extractContentBatch(
  urls: string[]
): Promise<ExtractedContent[]> {
  console.log(`📦 Batch extracting content from ${urls.length} URLs`);

  const extractionPromises = urls.map((url) => extractContentWithJina(url));

  const results = await Promise.allSettled(extractionPromises);
```

Using `Promise.allSettled` instead of `Promise.all` is crucial. `Promise.all` would reject immediately if any extraction fails, losing all results. `Promise.allSettled` waits for all promises and returns status for each.

**Practical Example - Promise.allSettled Results:**
```json
[
  { "status": "fulfilled", "value": { "url": "...", "markdown": "...", "wordCount": 2500, "success": true } },
  { "status": "fulfilled", "value": { "url": "...", "markdown": "...", "wordCount": 1800, "success": true } },
  { "status": "fulfilled", "value": { "url": "...", "markdown": "", "wordCount": 0, "success": false, "error": "Timeout" } },
  { "status": "fulfilled", "value": { "url": "...", "markdown": "...", "wordCount": 3200, "success": true } },
  { "status": "rejected", "reason": { "message": "Network error" } }
]
```

```typescript
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
```

The normalization logic handles both fulfilled and rejected promises, ensuring the output array always matches the input URL order and structure.

**Practical Example - Batch Extraction Complete Output:**
```json
[
  { "url": "https://www.guru99.com/...", "markdown": "[2500 words of content]", "wordCount": 2500, "success": true },
  { "url": "https://www.databaseguide.com/...", "markdown": "[1800 words of content]", "wordCount": 1800, "success": true },
  { "url": "https://blocked-site.com/...", "markdown": "", "wordCount": 0, "success": false, "error": "Request failed with status code 403" },
  { "url": "https://www.geeksforgeeks.org/...", "markdown": "[3200 words of content]", "wordCount": 3200, "success": true },
  { "url": "https://learn.microsoft.com/...", "markdown": "[2000 words of content]", "wordCount": 2000, "success": true }
]
```

Console output: `✅ Batch extraction completed: 4/5 successful`

### Result Merging

The `mergeResultsWithContent` function combines search metadata with extracted content:

```typescript
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
```

This function creates `EnhancedSearchResult` objects by combining the original Serper search metadata (title, URL, snippet) with the Jina-extracted full content. For failed extractions, the `extractionStatus` is set to "failed" and `fullContent` remains undefined.

**Practical Example - Enhanced Search Results:**
```json
[
  {
    "title": "Database Normalization Explained: 1NF, 2NF, 3NF, BCNF",
    "url": "https://www.guru99.com/database-normalization.html",
    "snippet": "Database normalization is the process of organizing data to minimize redundancy...",
    "fullContent": "# Database Normalization Explained...\n\n[full 2500 words]",
    "wordCount": 2500,
    "extractionStatus": "success"
  },
  {
    "title": "What is Third Normal Form (3NF)? - Database Guide",
    "url": "https://www.databaseguide.com/third-normal-form/",
    "snippet": "Third Normal Form (3NF) is achieved when a table is in 2NF...",
    "fullContent": "# Understanding Third Normal Form...\n\n[full 1800 words]",
    "wordCount": 1800,
    "extractionStatus": "success"
  },
  {
    "title": "Database Tutorial - Blocked Site",
    "url": "https://blocked-site.com/tutorial",
    "snippet": "Learn about database concepts and normalization...",
    "fullContent": undefined,
    "wordCount": 0,
    "extractionStatus": "failed"
  }
]
```

### Markdown Formatting

The `formatAsMarkdown` function creates a structured document for LLM consumption:

```typescript
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
```

The header section provides context about the search query and extraction statistics. Using `toLocaleString()` for word counts adds thousand separators for readability.

```typescript
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
```

Each source gets its own section with headers, metadata, and content. For failed extractions, the snippet is used instead of the full content.

**Practical Example - Formatted Markdown Output (truncated):**
```markdown
# Search Results: "what is database normalization third normal form database SQL explanation best practices"

*Found 5 sources, extracted full content from 4 pages (~9,500 total words)*

---

## 📄 Source 1: Database Normalization Explained: 1NF, 2NF, 3NF, BCNF
**URL**: https://www.guru99.com/database-normalization.html
**Snippet**: Database normalization is the process of organizing data to minimize redundancy...
**Content Length**: 2,500 words

### Full Content:
# Database Normalization Explained: 1NF, 2NF, 3NF, BCNF Examples

## What is Normalization?

Normalization is a database design technique that organizes tables in a manner that reduces redundancy and dependency of data...

[continues for 2500 words]

---

## 📄 Source 2: What is Third Normal Form (3NF)? - Database Guide
**URL**: https://www.databaseguide.com/third-normal-form/
**Snippet**: Third Normal Form (3NF) is achieved when a table is in 2NF...
**Content Length**: 1,800 words

### Full Content:
# Understanding Third Normal Form (3NF)

Third Normal Form is a crucial step in database normalization...

[continues for 1800 words]

---

## 📄 Source 3: Database Tutorial - Blocked Site
**URL**: https://blocked-site.com/tutorial
**Snippet**: Learn about database concepts and normalization...
**Status**: Content extraction failed

### Snippet Only:
Learn about database concepts and normalization...

---

[Sources 4 and 5 continue...]
```

---

## Content Summarization

### Summarizer Agent Configuration

```typescript
import { Agent } from "@mastra/core/agent";
import { gemini25FlashLite } from "../models/google";

const summarizerAgent = new Agent({
  name: "contentSummarizerAgent",
  instructions:
    "You are a specialized agent that extracts database-relevant information from search results.",
  model: gemini25FlashLite,
});
```

The summarizer uses Gemini 2.5 Flash Lite, chosen for its speed and low cost. The agent has minimal instructions since the specific extraction logic is provided in each prompt.

### Prompt Engineering

Three specialized prompts handle different search types:

**Business Domain Prompt:**
```typescript
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
```

**Practical Example - Business Domain Summarization:**

**Input (query):** `"hospital management system"`

**Input (content):** `[15,000 words of extracted content about hospital management systems, EHR systems, patient management, appointment scheduling, billing systems, etc.]`

**Output:**
```
Hospital management systems typically require entities for Patients, Doctors, Nurses, Appointments, Medical Records, Departments, Rooms, and Billing. The Patient entity serves as the central hub, connecting to Medical Records through a one-to-many relationship where each patient can have multiple records over time.

Appointments require a three-way relationship between Patient, Doctor, and Room, with time slot management preventing double-booking. The system must track appointment status (scheduled, completed, cancelled, no-show) for reporting and billing purposes.

Medical Records should implement versioning to maintain complete patient history while allowing updates. Each record links to the prescribing Doctor and may reference multiple Medications and Procedures through junction tables.

The Billing entity connects to Appointments and Procedures, requiring support for multiple payment sources (insurance, self-pay) and partial payments. Insurance claims need status tracking and document attachment capabilities.

Key constraints include ensuring doctor availability matches their department schedule, room capacity limits for group appointments, and mandatory fields for patient identification per healthcare regulations.
```

**Technical Pattern Prompt:**
```typescript
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
```

**Practical Example - Technical Pattern Summarization:**

**Input (query):** `"many-to-many relationship database design"`

**Input (content):** `[12,000 words about junction tables, composite keys, association tables, etc.]`

**Output:**
```
Many-to-many relationships require a junction table (also called association or linking table) containing foreign keys to both related tables. The junction table's primary key should be a composite of both foreign keys, ensuring uniqueness and preventing duplicate associations.

For a Student-Course relationship, create an Enrollment table with student_id and course_id as the composite primary key. Add created_at timestamp for tracking when the association was made. If additional data exists about the relationship (like grade or enrollment_date), include those columns in the junction table.

Index both foreign key columns individually for query performance when searching from either direction. The composite primary key automatically creates an index on (student_id, course_id), but queries filtering by course_id alone need a separate index.

Consider adding a surrogate primary key (auto-increment id) if the junction table will be referenced by other tables or if ORM frameworks require single-column keys. This adds overhead but simplifies foreign key relationships to the junction table.

For soft deletes, add a deleted_at nullable timestamp column rather than physically removing records. This preserves historical data while hiding inactive associations. Include deleted_at IS NULL in queries to filter active records.

Common mistakes include forgetting to index the second foreign key column, using nullable foreign keys (which defeats the purpose), and not considering cascading delete behavior for both parent tables.
```

### Compression Logic

```typescript
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
```

Content under 1,000 words bypasses summarization since the overhead exceeds the benefit. The compression ratio of 1.0 indicates no compression occurred.

```typescript
  console.log(
    `🔄 Summarizing ${searchType} search result (${originalWords} words)...`
  );

  let prompt: string;
  if (searchType === "business") {
    prompt = createBusinessSummaryPrompt(searchQuery, fullContent);
  } else if (searchType === "pattern") {
    prompt = createPatternSummaryPrompt(searchQuery, fullContent);
  } else {
    prompt = createGeneralSummaryPrompt(searchQuery, fullContent);
  }

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
```

The LLM generates the summary, which is then analyzed for statistics. The compression ratio calculation divides summarized words by original words.

**Practical Example - Summarization Result:**
```json
{
  "originalQuery": "what is database normalization third normal form",
  "condensedText": "Database normalization organizes data to minimize redundancy through progressive normal forms. First Normal Form (1NF) requires atomic values with no repeating groups. Second Normal Form (2NF) builds on 1NF by requiring all non-key attributes to fully depend on the primary key, eliminating partial dependencies. Third Normal Form (3NF) further requires no transitive dependencies between non-key attributes...\n\n[continues for ~450 words]",
  "originalWords": 9500,
  "summarizedWords": 450,
  "compressionRatio": 0.047
}
```

Console output: `✅ Summarization complete: 9,500 → 450 words (4.7%)`

This represents 95.3% compression, transforming 9,500 words into 450 words while preserving the essential information.

```typescript
  } catch (error) {
    console.error("❌ Summarization failed:", error);

    // Fallback: aggressive truncation
    const truncated = fullContent.substring(0, 2000);
    return {
      originalQuery: searchQuery,
      condensedText:
        truncated + "\n\n[Content truncated due to summarization failure]",
      originalWords,
      summarizedWords: 500,
      compressionRatio: 0.1,
    };
  }
}
```

If LLM summarization fails, the fallback aggressively truncates to 2,000 characters. This ensures the system remains functional even during LLM outages, though with reduced quality.

---

## Complete Flow Example

Let us trace a complete request from user query to final summarized output.

### Step 1: User Asks Question

The user sends a message within the chatbot:
```
"What is the difference between a primary key and a foreign key?"
```

### Step 2: Side Question Step Invokes Search

The workflow classifies this as a side question and invokes the General Knowledge Search Tool:

```typescript
const searchResult = await generalKnowledgeSearchTool.execute({
  context: { query: "What is the difference between a primary key and a foreign key?" },
  runtimeContext: {},
});
```

### Step 3: Search Query Enhancement

The tool enhances the query:
```
Original: "What is the difference between a primary key and a foreign key?"
Enhanced: "What is the difference between a primary key and a foreign key? database SQL explanation best practices"
```

### Step 4: Serper API Returns Results

```json
{
  "organic": [
    {
      "title": "Primary Key vs Foreign Key: What's the Difference?",
      "link": "https://www.example1.com/primary-foreign-key",
      "snippet": "A primary key uniquely identifies each record in a table, while a foreign key establishes a link between two tables..."
    },
    {
      "title": "SQL Keys Explained: Primary, Foreign, Unique, and Composite",
      "link": "https://www.example2.com/sql-keys",
      "snippet": "Understanding the different types of keys in SQL databases is essential for proper database design..."
    },
    // ... 3 more results
  ]
}
```

### Step 5: Jina Extracts Full Content

For each URL, Jina Reader fetches and converts to markdown. Example for first result:

```markdown
# Primary Key vs Foreign Key: What's the Difference?

## What is a Primary Key?

A primary key is a column (or set of columns) that uniquely identifies each row in a table. Every table should have a primary key to ensure data integrity and enable efficient lookups.

**Key characteristics:**
- Must contain unique values
- Cannot contain NULL values
- Only one primary key per table
- Automatically indexed

**Example:**
CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100)
);

## What is a Foreign Key?

A foreign key is a column that creates a relationship between two tables by referencing the primary key of another table...

[continues for 1,800 more words]
```

### Step 6: Results Merged and Formatted

Total extracted content: ~8,000 words across 5 sources.

### Step 7: Summarization

The summarizer compresses 8,000 words to ~400 words:

```
Primary keys uniquely identify each row in a table and enforce entity integrity. They must contain unique, non-null values, and each table can have only one primary key. Primary keys are automatically indexed for fast lookups. Common implementations use auto-incrementing integers (SERIAL/IDENTITY) or UUIDs.

Foreign keys establish relationships between tables by referencing another table's primary key. They enforce referential integrity by ensuring referenced values exist in the parent table. Foreign keys can be nullable (optional relationships) or NOT NULL (mandatory relationships).

The key distinction is that primary keys identify records within a table, while foreign keys connect records across tables. A foreign key in the child table points to the primary key in the parent table, creating one-to-many or many-to-one relationships.

When designing schemas, establish primary keys first, then create foreign keys to express relationships. Consider cascading behaviors (CASCADE, SET NULL, RESTRICT) for DELETE and UPDATE operations to maintain data consistency...

[continues for ~400 total words]
```

### Step 8: Context Prepared for LLM

The summarized content is formatted and prepended to the conversation context:

```markdown
## 📚 Search Context (Summarized)

*The following information has been gathered to help answer your question:*

### 📖 General Knowledge

Primary keys uniquely identify each row in a table and enforce entity integrity...
[full summary here]

*Compressed: 8,000 → 400 words (5% of original)*

---

# Conversation History

**User** (2 minutes ago):
What is the difference between a primary key and a foreign key?

---

# Current Request

What is the difference between a primary key and a foreign key?
```

### Step 9: Agent Generates Response

The Side Question Agent uses the enhanced context to generate an informed, accurate response combining its training knowledge with the fresh search results.

---

## Integration with Workflow Steps

### Side Question Step Integration

```typescript
// Inside side-question-step.ts execute function

if (enableSearch) {
  console.log(`🔍 Executing general knowledge search for: "${userMessage}"`);

  try {
    const searchResult = await (generalKnowledgeSearchTool as any).execute({
      context: { query: userMessage },
      runtimeContext: {},
    });

    if (searchResult) {
      const summary: SummarizedSearchResult = await summarizeSearchResult(
        searchResult.searchQuery,
        searchResult.fullContent,
        "general"
      );

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
    }
  } catch (searchError) {
    console.warn("⚠️ Search failed, continuing without search context:", searchError);
  }
}

const enhancedContext = searchContext
  ? `${searchContext}${fullContext}`
  : fullContext;

const result = await agent.generate(enhancedContext);
```

The step handles search failure gracefully by continuing without search context. The token estimation (`summarizedWords * 0.75`) approximates LLM tokens from word count.

### Schema Generation Step Integration

Schema generation steps (not shown in detail here) use Business Domain and DB Design Pattern search tools similarly, but may execute both searches and combine their summarized outputs before passing to the schema generation agent.

---

## Summary

The web search system provides a robust pipeline for enriching LLM context with current, relevant information. Through the combination of Google search via Serper, full content extraction via Jina, and intelligent summarization via Gemini, the system transforms potentially overwhelming amounts of web content into concise, focused context that enhances the chatbot's ability to provide accurate, informed responses about database concepts and schema design.

The architecture prioritizes resilience through graceful error handling at every stage, ensuring the chatbot remains functional even when individual components fail. The compression statistics provide transparency about information reduction, and the modular design allows each component to be tested and improved independently.
