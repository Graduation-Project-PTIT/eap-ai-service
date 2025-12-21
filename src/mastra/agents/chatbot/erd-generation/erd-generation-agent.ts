import { Agent } from "@mastra/core/agent";
import erdGenerationPrompt from "./prompts/erd-generation-prompt";
import { claudeSonnet45 } from "../../../models/anthropic";

/**
 * ERD Generation Agent
 *
 * This agent is designed to generate ERD schemas in Chen notation.
 * It receives pre-processed context and focuses purely on conceptual ERD design.
 *
 * Key Features:
 * - No tool calling (search handled by backend)
 * - Structured output via Zod schema
 * - Conversation history for modifications
 * - Chen notation support (weak entities, multivalued attributes, etc.)
 */
export const erdGenerationAgent = new Agent({
  name: "erdGenerationAgent",
  instructions: erdGenerationPrompt,
  model: claudeSonnet45,
});

export default erdGenerationAgent;

