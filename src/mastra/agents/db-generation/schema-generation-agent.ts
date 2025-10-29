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
      lastMessages: 20,

      // Working memory disabled (caused Gemini function call errors)
      workingMemory: {
        enabled: false,
      },

      // Semantic recall disabled for in-memory setup
      semanticRecall: false,
    },
  }),
});

export default schemaGenerationAgent;
