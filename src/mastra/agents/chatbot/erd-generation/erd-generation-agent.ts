import { Agent } from "@mastra/core/agent";
import erdGenerationPrompt from "./prompts/erd-generation-prompt";
import { claudeSonnet45 } from "../../../models/anthropic";

export const erdGenerationAgent = new Agent({
  name: "erdGenerationAgent",
  instructions: erdGenerationPrompt,
  model: claudeSonnet45,
});

export default erdGenerationAgent;

