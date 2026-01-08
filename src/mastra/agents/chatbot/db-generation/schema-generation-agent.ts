import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { gemini25Flash, gemini25Pro } from "../../../models/google";
import schemaGenerationPrompt from "./prompts/schema-generation-prompt";
import { Agent } from "@mastra/core/agent";
import { gpt41 } from "../../../models/openai";
import { claudeHaiku45, claudeSonnet45 } from "../../../models/anthropic";

export const schemaGenerationAgent = new Agent({
  name: "schemaGenerationAgent",
  instructions: schemaGenerationPrompt,
  model: claudeHaiku45,
});

export default schemaGenerationAgent;
