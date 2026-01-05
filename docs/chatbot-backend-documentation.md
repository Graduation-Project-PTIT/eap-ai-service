# Chatbot Backend Function Documentation

This document provides a comprehensive technical explanation of the chatbot backend functionality in the EAP AI Service. The chatbot is designed to assist users in designing database schemas through natural language conversations, supporting both Entity-Relationship Diagram (ERD) generation and Physical Database schema generation with DDL scripts.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Request Handler](#request-handler)
3. [Main Chatbot Workflow](#main-chatbot-workflow)
4. [Workflow Steps](#workflow-steps)
   - [Side Question Step](#side-question-step)
   - [Schema Workflow Branch Step](#schema-workflow-branch-step)
   - [ERD Workflow Branch Step](#erd-workflow-branch-step)
5. [Sub-Workflows](#sub-workflows)
   - [DB Generation Workflow](#db-generation-workflow)
   - [ERD Generation Workflow](#erd-generation-workflow)
6. [Web Search Tools](#web-search-tools)
   - [General Knowledge Search Tool](#general-knowledge-search-tool)
   - [Business Domain Search Tool](#business-domain-search-tool)
   - [Database Design Pattern Search Tool](#database-design-pattern-search-tool)
7. [Content Processing Utilities](#content-processing-utilities)
   - [Content Extractor](#content-extractor)
   - [Content Summarizer](#content-summarizer)
8. [Supporting Services](#supporting-services)
9. [Data Flow Summary](#data-flow-summary)

---

## Architecture Overview

The chatbot backend follows a layered architecture built on top of the Mastra framework, which provides workflow orchestration, agent management, and tool execution capabilities. At the highest level, user requests enter through an HTTP handler, which performs initial processing such as authentication, conversation management, and intent classification before delegating the core logic to a workflow system.

The system distinguishes between three primary types of user interactions. First, side questions are general inquiries about database concepts, the current schema, or off-topic questions that do not require schema modification. Second, schema generation requests are instructions to create or modify database schemas, which can be either conceptual ERD diagrams or physical database schemas with DDL scripts. Third, conversion requests are special instructions to transform an existing ERD into a physical database schema.

The workflow system uses a branching architecture where the main chatbot workflow routes requests to specialized steps based on the pre-classified intent. Each branch step may invoke sub-workflows that contain additional processing steps, creating a hierarchical execution model that promotes modularity and separation of concerns.

---

## Request Handler

The entry point for all chatbot interactions is the `sendMessageHandler` function located in [send-message.handler.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/api/modules/chatbot/handlers/send-message.handler.ts). This handler orchestrates the entire request lifecycle through a sequence of seventeen distinct steps.

The handler begins by parsing and validating the incoming JSON request against a Zod schema defined in the input types. The request must contain a message string and optionally a conversation ID and an enableSearch boolean flag. The handler extracts the authenticated user from the request context, which Hono middleware populates after JWT verification.

Following input validation, the handler either retrieves an existing conversation by its ID or creates a new conversation record in the PostgreSQL database. Each conversation maintains state including the current ERD schema, physical database schema, DDL script, business domain, and diagram type. The handler verifies that the authenticated user owns the conversation, returning a 403 Forbidden response if ownership verification fails.

The conversation history retrieval step queries the message table for all previous messages in the conversation, ordered chronologically. This history serves two purposes during subsequent processing. It provides context for intent classification, and it forms part of the context window sent to the LLM for response generation.

Intent classification is a critical pre-processing step performed before workflow execution. The handler invokes the intent classification service, which uses a specialized LLM agent to analyze the user message and conversation history. The classification result contains the primary intent (schema or side-question), a schema sub-intent for schema requests (create or modify), the target diagram type (ERD or PHYSICAL_DB), an optional extracted business domain, and a confidence score.

If the classification identifies a business domain with sufficient confidence, the handler persists this domain to the conversation record. This domain context enhances subsequent search queries by providing industry-specific terminology and context for web searches.

The handler performs validation specific to schema requests, checking for scenarios that should be blocked. For example, attempting to modify a non-existent schema or requesting a physical database schema when no ERD exists for conversion generates a graceful blocking response rather than proceeding with an invalid operation.

Special handling exists for ERD-to-Physical-DB conversion requests. When the intent classification detects conversion intent and a valid ERD schema exists, the handler bypasses the normal workflow and directly invokes the conversion service. This optimization avoids unnecessary search operations since conversion relies entirely on the existing ERD structure.

For standard requests, the handler builds a full context string that combines schema information, conversation history, and the current user message. This context construction differs based on the operation type. For modification requests, the existing schema is included with explicit modification instructions, while creation requests focus on conversation history and the new requirements.

The handler persists the user message to the database before workflow execution, ensuring message durability regardless of workflow outcome. It then creates a workflow run and starts execution with the prepared input data structure.

Upon workflow completion, the handler extracts results from the nested workflow response structure. The branching architecture means results may be wrapped under different step identifiers depending on which branch executed. The handler normalizes these results, extracting the response text, updated schemas, DDL script, and execution metadata.

For initial ERD creation, the handler appends a helpful tip to the response, informing users about the conversion capability. This user experience enhancement guides users toward the next logical step in the schema design process.

The handler persists both the assistant response and any schema updates to the database. Schema updates are stored both in the conversation record for quick access and as snapshots in the message metadata for version history. Finally, the handler constructs and returns a JSON response containing the conversation ID, response text, schemas, DDL script, diagram type, and workflow run ID.

### Handler Input Schema

The handler accepts a JSON body with the following fields. The `conversationId` field is an optional UUID string that identifies an existing conversation to continue. When omitted, the handler creates a new conversation. The `message` field is a required non-empty string containing the user's current message or request. The `enableSearch` field is an optional boolean that defaults to true and controls whether web search tools execute during workflow processing.

### Handler Output Schema

The handler returns a JSON response containing several fields. The `success` field is a boolean indicating whether the request completed successfully. The `conversationId` field is the UUID of the conversation, either pre-existing or newly created. The `response` field contains the assistant's textual response to the user message. The `schema` field holds the current physical database schema as a structured object with entities and relationships. The `erdSchema` field contains the current ERD schema with entities, attributes, and relationships in Chen notation. The `ddl` field is the SQL DDL script for the physical database schema. The `diagramType` field indicates the type of the most recently generated schema, either "ERD" or "PHYSICAL_DB". The `runId` field is the unique identifier for the workflow execution, useful for debugging and tracing. The optional `blocked` field indicates whether the request was blocked due to validation rules.

---

## Main Chatbot Workflow

The main chatbot workflow is defined in [chatbot.workflow.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/workflows/chatbot/chatbot.workflow.ts) and serves as the central routing mechanism for all chatbot operations. Built using the Mastra `createWorkflow` function, it implements a branching pattern that directs requests to specialized processing steps based on the pre-classified intent.

The workflow does not perform intent classification itself. This design decision was made to enable smart context building in the handler before workflow execution. By classifying intent early, the handler can construct optimized context that includes only relevant schema information for the operation type, reducing token consumption and improving response quality.

### Workflow Input Schema

The workflow accepts a structured input object with multiple fields serving different purposes. The `userMessage` field is a required non-empty string containing the user's current message, primarily used by search tools to formulate search queries. The `fullContext` field is a required string containing the complete context for LLM processing, including schema information and conversation history as assembled by the handler. The `domain` field is a nullable string representing the business domain context for search query enrichment, such as "e-commerce" or "healthcare". The `schemaContext` field is a nullable string containing the current database schema DDL when available. The `conversationHistory` field is an optional array of role-content pairs representing previous conversation messages. The `intent` field is a required enum of either "schema" or "side-question" indicating the pre-classified primary intent. The `schemaIntent` field is a nullable enum of either "create" or "modify" indicating the sub-intent for schema operations. The `diagramType` field is a nullable enum of either "ERD" or "PHYSICAL_DB" indicating the target diagram type for schema generation. The `confidence` field is a required number between 0 and 1 representing the confidence score of the intent classification. The `enableSearch` field is an optional boolean defaulting to true that controls whether web search tools execute.

### Workflow Output Schema

The workflow uses a unified output schema that accommodates all possible branch outcomes. This is a Mastra requirement since all branches must produce compatible output shapes. The `response` field is an optional string containing the assistant's response text. The `updatedSchema` field is an optional object containing the updated physical database schema following the `dbInformationGenerationSchema` structure. The `updatedErdSchema` field is an optional object containing the updated ERD schema following the `erdInformationGenerationSchema` structure. The `ddlScript` field is an optional string containing the generated SQL DDL script. The `agentResponse` field is an optional string containing the original agent response before any handler modifications. The `isSideQuestion` field is a required boolean indicating whether the request was handled as a side question. The `isSchemaGeneration` field is a required boolean indicating whether the request was handled as physical database schema generation. The `isErdGeneration` field is an optional boolean indicating whether the request was handled as ERD generation.

### Branch Routing Logic

The workflow defines three branches evaluated in sequence. The first branch checks if the intent equals "side-question" and routes to the Side Question Step when true. The second branch checks if the intent equals "schema" and the diagram type equals "ERD", routing to the ERD Workflow Branch Step when both conditions are satisfied. The third branch checks if the intent equals "schema" and the diagram type equals "PHYSICAL_DB", routing to the Schema Workflow Branch Step when both conditions are met.

Each branch condition is an asynchronous function that logs the evaluation for debugging purposes. Only one branch executes per workflow run, determined by the first condition that evaluates to true. If no branch condition matches, the workflow would fail, though the handler's intent classification ensures one branch always matches.

---

## Workflow Steps

### Side Question Step

The Side Question Step, defined in [side-question-step.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/workflows/chatbot/steps/side-question-step.ts), handles general questions and off-topic queries that do not require schema modification. This step demonstrates the integration of web search capabilities with LLM processing to provide informed, contextual responses.

The execution flow proceeds through four distinct phases. In the first phase, if the `enableSearch` flag is true, the step executes the general knowledge search tool using the user's message as the search query. The search targets database-related knowledge and concept explanations, returning a structured result with full content extracted from search results.

In the second phase, the search results undergo summarization to compress the content while preserving relevant information. The summarizer targets 80-90% compression, transforming potentially thousands of words from multiple web pages into a concise summary suitable for LLM context injection.

In the third phase, the summarized search context is prepended to the full context provided in the input. The formatting includes a header section, compression statistics, and clear visual separation from the original context.

In the fourth phase, the enhanced context is passed to the Side Question Agent, which generates a response using the Claude Haiku model. The agent's instructions configure it to explain existing schemas, clarify database concepts, answer general questions, and provide guidance, while explicitly prohibiting schema creation or modification.

#### Step Input Fields

The step input contains all fields from the workflow input schema, passed through from the branch router. The `userMessage` field contains the user's question for search query formulation. The `fullContext` field contains the complete context including any existing schema and conversation history. The `domain` field provides optional business domain for context. The `schemaContext` field contains the DDL script if available. The `conversationHistory` field holds previous messages. The `intent` field confirms the "side-question" classification. The `schemaIntent` field is null for side questions. The `diagramType` field is null for side questions. The `confidence` field indicates classification confidence. The `enableSearch` field controls search execution.

#### Step Output Fields

The step output includes the `response` field containing the generated assistant response. The `updatedSchema` field is always undefined since side questions do not modify schemas. The `ddlScript` field is always undefined for the same reason. The `agentResponse` field is always undefined as the response is placed in the `response` field. The `isSideQuestion` field is always true. The `isSchemaGeneration` field is always false. The `searchMetadata` field is an optional object containing `searchPerformed` (boolean indicating if search executed), `searchTokens` (estimated token count of summarized search content), and `compressionRatio` (ratio of summarized to original content size).

### Schema Workflow Branch Step

The Schema Workflow Branch Step, defined in [schema-workflow-branch-step.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/workflows/chatbot/steps/schema-workflow-branch-step.ts), serves as a delegation layer that invokes the DB Generation Workflow when users request physical database schema creation or modification.

The step retrieves the dbGenerationWorkflow from the Mastra instance and creates a new asynchronous run. It forwards the relevant input fields including the user message, full context, domain, and search settings. After the sub-workflow completes, the step extracts the results and maps them to the branch output schema, setting appropriate flags to indicate physical database generation occurred.

#### Step Input Fields

The input schema mirrors the main workflow input. The step uses `userMessage`, `fullContext`, `domain`, and `enableSearch` for the sub-workflow invocation. Other fields are present but not directly used by this step.

#### Step Output Fields

The `response` field contains the agent response from the sub-workflow. The `updatedSchema` field contains the generated or modified physical database schema. The `updatedErdSchema` field is undefined since this branch handles physical schemas. The `ddlScript` field contains the generated SQL DDL script. The `agentResponse` field duplicates the response for compatibility. The `isSideQuestion` field is false. The `isSchemaGeneration` field is true. The `isErdGeneration` field is false.

### ERD Workflow Branch Step

The ERD Workflow Branch Step, defined in [erd-workflow-branch-step.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/workflows/chatbot/steps/erd-workflow-branch-step.ts), mirrors the schema branch but invokes the ERD Generation Workflow instead. This step handles requests for conceptual Entity-Relationship Diagram creation or modification using Chen notation.

The step follows the same delegation pattern, creating a sub-workflow run and forwarding input parameters. Upon completion, it extracts the ERD schema and agent response, logging statistics about the generated entities and relationships.

#### Step Input Fields

The input schema matches the main workflow input. The step forwards `userMessage`, `fullContext`, `domain`, and `enableSearch` to the sub-workflow.

#### Step Output Fields

The `response` field contains the agent response from the sub-workflow. The `updatedSchema` field is undefined since this branch produces ERD schemas. The `updatedErdSchema` field contains the generated or modified ERD schema in Chen notation. The `ddlScript` field is undefined since ERDs do not have DDL scripts. The `agentResponse` field duplicates the response for compatibility. The `isSideQuestion` field is false. The `isSchemaGeneration` field is false (distinguishing from physical schema generation). The `isErdGeneration` field is true.

---

## Sub-Workflows

### DB Generation Workflow

The DB Generation Workflow, defined in [db-generation.workflow.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/workflows/chatbot/db-generation/db-generation.workflow.ts), handles physical database schema creation and modification through a two-step sequential process.

The workflow is designed to handle both initial schema creation and ongoing modification within a single flow, eliminating the need for separate create and modify workflows. The agent determines from context whether it is starting fresh or modifying an existing schema.

The first step is the Schema Generation Step, which uses web search tools to gather business domain knowledge and database design patterns, then generates or modifies the physical database schema. This step produces a structured schema object representing tables, columns, relationships, and constraints.

The second step is the DDL Generation Step, which takes the schema from the previous step and generates a SQL DDL script. This script includes CREATE TABLE statements, column definitions, primary and foreign key constraints, and indexes.

#### Workflow Input Fields

The `userMessage` field is required and contains the user's message for search tool query formulation. The `fullContext` field is required and contains schema and history context for LLM processing. The `domain` field is nullable and provides business domain for search enrichment. The `enableSearch` field is optional, defaulting to true.

#### Workflow Output Fields

The `updatedSchema` field contains the physical database schema following the `dbInformationGenerationSchema` structure. The `ddlScript` field contains the generated SQL DDL script. The `agentResponse` field contains the human-readable explanation of the changes made.

### ERD Generation Workflow

The ERD Generation Workflow, defined in [erd-generation.workflow.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/workflows/chatbot/erd-generation/erd-generation.workflow.ts), handles ERD schema creation and modification through a single-step process. Unlike the DB generation workflow, no DDL generation occurs since ERDs represent conceptual models rather than physical implementations.

The workflow supports Chen notation features including regular entities, weak entities (dependent on other entities for identification), regular attributes, key attributes (primary identifiers), multivalued attributes (can have multiple values), derived attributes (computed from other attributes), composite attributes (containing sub-attributes), and various relationship types (identifying, non-identifying, and total participation).

#### Workflow Input Fields

The input mirrors the DB generation workflow with the same four fields: `userMessage`, `fullContext`, `domain`, and `enableSearch`.

#### Workflow Output Fields

The `updatedErdSchema` field contains the ERD schema following the `erdInformationGenerationSchema` structure. The `agentResponse` field contains the human-readable explanation of the design.

---

## Web Search Tools

The chatbot employs three specialized web search tools, each optimized for different information retrieval scenarios. All three tools share a common architecture: they use the Serper API for Google search, extract full content from result URLs using the Jina Reader API, and format the results as structured markdown for LLM consumption.

### General Knowledge Search Tool

The General Knowledge Search Tool, defined in [general-knowledge-search.tool.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/tools/general-knowledge-search.tool.ts), searches for general database knowledge and concept explanations. This tool is primarily used by the Side Question Step to provide informed answers to user questions about database concepts, SQL syntax, and best practices.

#### Tool Description and Use Cases

The tool is designed for scenarios where users ask about database concepts such as normalization, indexes, transactions, or ACID properties. It handles SQL syntax explanation requests, helps users understand database best practices, and addresses general technical questions related to databases.

Example queries that this tool handles well include "what is database normalization", "how do foreign keys work", "difference between inner join and outer join", "what is ACID in databases", and "how to optimize SQL queries".

The tool should not be used for specific business domain requirements (use Business Domain Search instead) or complex design patterns (use DB Design Pattern Search instead).

#### Tool Input Schema

The tool accepts a single input field. The `query` field is a required string with minimum length of 3, containing the user's question or topic to search for.

#### Tool Output Schema

The tool returns a structured object with four fields. The `searchQuery` field contains the actual search query sent to Serper, which may be enhanced from the original query. The `summary` field contains a brief summary of extraction results including success counts and word totals. The `fullContent` field contains the complete extracted content from all search results formatted as markdown with source citations. The `metadata` field is an object containing `totalResults` (number of search results), `successfulExtractions` (number of pages successfully extracted), and `totalWords` (total word count across all extracted content).

#### Execution Flow

When executed, the tool first validates that the SERPER_API_KEY environment variable is configured. It then constructs an enhanced search query by appending "database SQL explanation best practices" to the user's original query, biasing results toward educational content.

The tool sends a POST request to the Serper API (`https://google.serper.dev/search`) requesting five organic results. The API returns structured data including titles, links, snippets, and position information for each result.

For each search result, the tool extracts the URL and initiates full content extraction using the Jina Reader API. This extraction happens in parallel through the `extractContentBatch` utility function, which uses `Promise.allSettled` to ensure individual extraction failures do not block the entire operation.

The extracted content is merged with the original search results, creating enhanced result objects that include both the search metadata and the full page content. The tool then formats this combined data as markdown using the `formatAsMarkdown` utility, producing a structured document with headers, source citations, and full content sections.

Finally, the tool returns the complete result object including the search query, summary, formatted markdown content, and extraction metadata.

### Business Domain Search Tool

The Business Domain Search Tool, defined in [business-domain-search.tool.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/tools/business-domain-search.tool.ts), searches for business requirements and domain concepts specific to industry verticals. This tool helps the LLM understand what entities, workflows, and relationships typically exist in unfamiliar business domains.

#### Tool Description and Use Cases

The tool is designed for scenarios where users request schemas for unfamiliar business domains such as healthcare, e-commerce, logistics, or education systems. It helps discover what entities and tables are typically needed in a domain, understand business workflows and processes, and identify domain-specific terminology and vocabulary.

Example queries include "hospital management system core entities and business workflows", "e-commerce platform essential database entities", "school management system functional requirements entities", and "banking system core business entities".

The tool should not be used for simple CRUD applications like todo lists or blogs, technical database patterns (use DB Design Pattern Search instead), or domains where the LLM already has strong knowledge.

#### Tool Input Schema

The tool accepts a single input field. The `domain` field is a required string with minimum length of 3, describing the business domain to search for, such as "hospital management", "e-commerce", or "school management".

#### Tool Output Schema

The output schema matches the General Knowledge Search Tool with `searchQuery`, `summary`, `fullContent`, and `metadata` fields structured identically.

#### Execution Flow

The execution flow closely mirrors the General Knowledge Search Tool with different query construction logic. The tool enhances the domain input by appending "system core entities business requirements database", targeting content about system design and database requirements for the specified domain.

The subsequent steps of Serper API search, content extraction, result merging, and markdown formatting follow the same pattern as the General Knowledge Search Tool.

### Database Design Pattern Search Tool

The Database Design Pattern Search Tool, defined in [db-design-pattern-search.tool.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/tools/db-design-pattern-search.tool.ts), searches for technical database design patterns and implementation best practices. This tool is used after entities are identified, when the LLM needs guidance on properly modeling complex relationships or implementing specific patterns.

#### Tool Description and Use Cases

The tool addresses scenarios involving complex relationship modeling such as many-to-many, polymorphic, or hierarchical relationships. It provides guidance for specific pattern implementations including audit trails, soft deletes, and versioning systems. The tool also helps with normalization and denormalization decisions and SQL best practices for particular scenarios.

Example queries include "many-to-many relationship database design best practices", "polymorphic association database pattern", "hierarchical data database design nested sets", "audit trail database schema pattern", "soft delete database implementation", and "multi-tenant database schema design".

The tool should not be used for understanding business requirements (use Business Domain Search instead), simple foreign key relationships, or basic one-to-many relationships.

#### Tool Input Schema

The tool accepts a single input field. The `pattern` field is a required string with minimum length of 3, describing the database pattern or problem to search for, such as "many-to-many relationship", "audit trail pattern", or "polymorphic association".

#### Tool Output Schema

The output schema matches the other search tools with `searchQuery`, `summary`, `fullContent`, and `metadata` fields.

#### Execution Flow

The tool constructs search queries by appending "database design pattern best practices SQL" to the pattern input. This suffix biases results toward practical implementation guidance rather than theoretical discussions.

The remaining execution flow follows the same pattern as the other search tools, using Serper for search, Jina for content extraction, and the utility functions for result formatting.

---

## Content Processing Utilities

### Content Extractor

The Content Extractor utility, defined in [content-extractor.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/utils/content-extractor.ts), provides functionality for extracting full webpage content using the Jina Reader API and formatting results for optimal LLM consumption.

#### Core Extraction Function

The `extractContentWithJina` function takes a URL string and returns a Promise resolving to an `ExtractedContent` object. This function makes a GET request to the Jina Reader API at `https://r.jina.ai/{url}`, which returns the webpage content converted to markdown format.

The function enforces a 10-second timeout to prevent long-running extractions from blocking the workflow. Content is truncated at 50,000 characters to prevent excessively large responses from consuming too many tokens. The function logs extraction progress and returns a structured result including the markdown content, word count, and success status.

If extraction fails due to network errors, timeouts, or inaccessible pages, the function returns a failure result with an empty markdown field and an error message, allowing the calling code to gracefully handle partial failures.

#### Batch Extraction Function

The `extractContentBatch` function processes multiple URLs in parallel using `Promise.allSettled`. This approach ensures that one failed extraction does not block the entire batch. The function logs batch progress including the number of successful extractions versus total attempts.

The function returns an array of `ExtractedContent` objects in the same order as the input URLs, with failed extractions marked accordingly. This parallel execution significantly reduces total processing time compared to sequential extraction.

#### Result Formatting Functions

The `mergeResultsWithContent` function combines original search results from Serper with extracted content from Jina. It produces an array of `EnhancedSearchResult` objects containing both the search metadata (title, URL, snippet) and the extracted content (full markdown, word count, extraction status).

The `formatAsMarkdown` function transforms enhanced results into a structured markdown document optimized for LLM consumption. The document includes a header with the search query, summary statistics, and individual sections for each source. Each source section contains the title, URL, snippet, content length, and either the full extracted content or the snippet if extraction failed.

The `generateExtractionSummary` function produces a human-readable summary of extraction results, including counts of successful and failed extractions and total word counts.

### Content Summarizer

The Content Summarizer utility, defined in [content-summarizer.ts](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/utils/content-summarizer.ts), compresses extracted search content to reduce token consumption while preserving database-relevant information.

#### Summarization Agent

The utility creates a lightweight summarization agent using the Gemini 2.5 Flash Lite model, chosen for its speed and cost efficiency. This agent receives search content along with a specialized prompt instructing it to extract only database-relevant information.

#### Summarization Function

The `summarizeSearchResult` function accepts three parameters: the original search query, the full content to summarize, and the search type (business, pattern, or general). The function first checks if the content is already small enough (under 1,000 words) and skips summarization if so.

For larger content, the function constructs a specialized prompt based on the search type. Business domain prompts focus on extracting entities, relationships, business rules, and domain best practices. Pattern prompts focus on SQL table structures, relationship modeling, performance considerations, and implementation guidelines. General knowledge prompts focus on direct answers, key concepts, practical examples, and best practices.

Each prompt instructs the agent to produce a summary under 500 words while preserving all critical information. The function logs compression statistics and returns a `SummarizedSearchResult` object containing the original query, condensed text, word counts, and compression ratio.

If summarization fails, the function falls back to aggressive truncation, taking the first 2,000 characters of the original content with a note indicating the failure.

#### Context Formatting Function

The `formatSummarizedContext` function takes optional business and pattern summaries and combines them into a formatted context block. The block includes headers, the summarized content, and compression statistics, providing transparency about the information compression that occurred.

---

## Supporting Services

The chatbot functionality relies on several supporting services located in [services](file:///Users/ric.do/Documents/Dev/ptit_grad/code/eap-ai-service/src/mastra/api/modules/chatbot/services) directory.

### Intent Classification Service

The Intent Classification Service uses a specialized LLM agent to analyze user messages and determine the appropriate handling path. The service builds contextual prompts that include recent conversation history when available, enabling more accurate classification for follow-up messages.

The classification result includes the primary intent (schema or side-question), schema sub-intent (create or modify), diagram type (ERD or PHYSICAL_DB), extracted business domain, domain confidence, and overall classification confidence. The service defaults to ERD generation for schema intents when the diagram type is ambiguous.

### Context Builder Service

The Context Builder Service constructs the full context string sent to the LLM. The context varies based on the operation type. For modification operations, the existing schema is included with explicit modification instructions. The service also formats conversation history with relative timestamps and separates sections with visual markers for LLM parsing.

### Workflow Executor Service

The Workflow Executor Service encapsulates workflow execution logic, creating runs, forwarding input, and extracting results from the nested response structure. The service normalizes results from different branch steps into a consistent format for the handler.

### Conversation Service

The Conversation Service handles database operations for conversation management, including creation, retrieval, ownership verification, history fetching, and schema updates. The service provides typed interfaces for conversation and message records.

### Schema Validation Service

The Schema Validation Service checks for blocking conditions such as attempting to modify non-existent schemas or requesting invalid operations. The service returns validation results indicating whether the request should proceed or be blocked with a specific message.

### ERD Conversion Service

The ERD Conversion Service handles the special case of converting an ERD schema to a physical database schema. This service invokes a conversion workflow that transforms Chen notation entities and relationships into table definitions with DDL scripts.

---

## Data Flow Summary

The complete data flow for a chatbot request proceeds as follows.

A user sends an HTTP POST request to the chatbot endpoint with a message and optional conversation ID. The handler validates the request, authenticates the user, and retrieves or creates the conversation. Previous messages are fetched from the database, and the Intent Classification Agent analyzes the message with conversation context.

Based on the classification result, the handler may update the conversation domain and validates the request against current state. If the request is blocked, a friendly response is returned without workflow execution.

For valid requests, the handler builds the full context string combining schema information and conversation history. The user message is persisted, and the main chatbot workflow is invoked with structured input.

The workflow evaluates branch conditions and routes to the appropriate step. For side questions, the step optionally executes a web search, summarizes results, and generates a response using the Side Question Agent. For schema requests, the step delegates to either the ERD or DB generation sub-workflow.

Sub-workflows may execute their own web searches for business domain knowledge and design patterns. The search results are extracted, summarized, and prepended to the LLM context. The schema generation or modification agent produces a structured schema object, and for physical database workflows, the DDL generation agent produces SQL scripts.

Results bubble up through the workflow hierarchy to the handler. The handler persists the assistant response and schema updates, constructs the API response, and returns the result to the user.

Throughout this flow, extensive logging provides visibility into each processing stage, including intent classification results, context lengths, search statistics, and execution timing.
