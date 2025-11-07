import { Agent } from "@mastra/core";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { gemini25Flash } from "../../models/google";
import schemaGenerationPrompt from "./prompts/schema-generation-prompt";

/**
 * Conversational Schema Agent (Optimized)
 *
 * This agent is designed to work with backend-controlled search.
 * It receives pre-processed search context and focuses purely on schema design.
 *
 * Key Features:
 * - No tool calling (search handled by backend)
 * - Structured output via Zod schema
 * - Conversation history for modifications
 * - Fast & cost-efficient
 */
export const schemaGenerationAgent = new Agent({
  name: "schemaGenerationAgent",
  instructions: schemaGenerationPrompt,
  model: gemini25Flash,

  // 🚫 NO TOOLS - Backend handles all searches
  // Tools removed to enable structured output without conflicts

  memory: new Memory({
    storage: new LibSQLStore({
      url: ":memory:",
    }),
    options: {
      // Keep conversation history for schema modifications
      lastMessages: 3,

      // ✅ Working memory ENABLED - automatically saves/retrieves schema
      // This allows the agent to remember the current schema state
      // and intelligently update it during modifications
      workingMemory: {
        enabled: true,
        scope: "thread", // Memory isolated per conversation thread
        template: `# Current Database Schema

## Schema Status
- Status: [empty | in-progress | complete]
- Last Modified: [timestamp]

## Entities
[List of entity names and their key attributes will be tracked here]

## Recent Changes
[Brief description of the most recent schema modifications]
`,
      },

      // Semantic recall disabled for in-memory setup
      semanticRecall: false,
    },
  }),
});

export default schemaGenerationAgent;
