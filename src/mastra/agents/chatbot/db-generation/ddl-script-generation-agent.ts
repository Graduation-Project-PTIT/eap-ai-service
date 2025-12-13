import ddlScriptGenerationPrompt from "./prompts/ddl-script-generation-prompt";
import { gemini25FlashLite } from "../../../models/google";
import { Agent } from "@mastra/core/agent";
import { gpt41Mini } from "../../../models/openai";

/**
 * DDL Script Generation Agent
 *
 * Generates SQL DDL statements from schema JSON.
 * Uses low temperature for deterministic, precise SQL output.
 *
 * Memory is simplified as DDL generation is more stateless,
 * but conversation history helps track what was already generated.
 */
const ddlScriptGenerationAgent = new Agent({
  name: "ddlScriptGenerationAgent",
  instructions: ddlScriptGenerationPrompt,
  model: gemini25FlashLite,
});

export default ddlScriptGenerationAgent;
