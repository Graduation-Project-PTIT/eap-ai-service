import { Agent } from "@mastra/core";
import { google } from "@ai-sdk/google";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { createSchemaGenerationPrompt } from "./prompts/schema-generation-prompt";
import businessDomainSearchTool from "../../tools/business-domain-search.tool";
import dbDesignPatternSearchTool from "../../tools/db-design-pattern-search.tool";
import { gemini25Flash } from "../../models/google";
import { create } from "domain";

/**
 * Conversational Schema Agent
 *
 * This agent is intelligent enough to:
 * 1. CREATE new schemas from scratch (when no existing schema)
 * 2. MODIFY existing schemas based on user requests
 * 3. EXPLAIN design decisions
 * 4. SUGGEST improvements
 * 5. SEARCH for business domain knowledge and technical patterns (NEW)
 *
 * The agent maintains conversation context through memory:
 * - Conversation History: Last 20 messages for immediate context
 * - Working Memory: Tracks current schema state, user preferences
 * - Semantic Recall: Retrieves relevant past design decisions
 *
 * Tools (when search enabled):
 * - Business Domain Search: Discovers entities and workflows for specific industries
 * - DB Design Pattern Search: Learns technical patterns for complex relationships
 *
 * Performance: Uses gemini-2.5-flash for fast response times
 */
export const conversationalSchemaAgent = new Agent({
  name: "conversationalSchemaAgent",
  instructions: createSchemaGenerationPrompt(false),
  model: gemini25Flash,

  // Tools available to the agent when search is enabled
  tools: {
    businessDomainSearch: businessDomainSearchTool,
    dbDesignPatternSearch: dbDesignPatternSearchTool,
  },

  memory: new Memory({
    storage: new LibSQLStore({
      url: ":memory:",
    }),
    // Vector storage not needed for in-memory setup
    options: {
      // Conversation History: Keep last 20 messages for context
      // This already stores all schemas generated - no need for separate working memory
      lastMessages: 20,

      // Working Memory: DISABLED to prevent Gemini malformed function call errors
      // The updateWorkingMemory tool was causing "print(default_api.updateWorkingMemory(...))" errors
      // Conversation history is sufficient for schema persistence
      workingMemory: {
        enabled: false,
      },

      // Semantic Recall: Disabled for in-memory storage simplicity
      // To enable, configure an embedder and use file-based storage
      semanticRecall: false,
    },
  }),
});

export default conversationalSchemaAgent;
