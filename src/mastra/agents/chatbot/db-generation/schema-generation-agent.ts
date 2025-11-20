import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { gemini25Flash } from "../../../models/google";
import schemaGenerationPrompt from "./prompts/schema-generation-prompt";
import { Agent } from "@mastra/core/agent";
import { gpt41 } from "../../../models/openai";
import { claudeHaiku45 } from "../../../models/anthropic";

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
  model: gpt41,
});

export default schemaGenerationAgent;
