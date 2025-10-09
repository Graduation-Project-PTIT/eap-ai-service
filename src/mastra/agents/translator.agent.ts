import { Agent } from "@mastra/core/agent";
import translatorPrompt from "./prompts/translator.prompt";
import { gemini25FlashLite } from "../models/google";

const translatorAgent = new Agent({
  name: "translatorAgent",
  instructions: translatorPrompt,
  model: gemini25FlashLite,
});

export default translatorAgent;
