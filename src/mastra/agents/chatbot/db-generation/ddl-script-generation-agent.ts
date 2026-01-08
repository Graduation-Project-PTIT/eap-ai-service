import ddlScriptGenerationPrompt from "./prompts/ddl-script-generation-prompt";
import { gemini25FlashLite } from "../../../models/google";
import { Agent } from "@mastra/core/agent";
import { gpt41Mini } from "../../../models/openai";

const ddlScriptGenerationAgent = new Agent({
  name: "ddlScriptGenerationAgent",
  instructions: ddlScriptGenerationPrompt,
  model: gemini25FlashLite,
});

export default ddlScriptGenerationAgent;
