import { Agent } from "@mastra/core/agent";
import dbInformationExtractPrompt from "./prompts/db-information-extract.prompt";
import { gemini25FlashLite } from "../../models/google";

const dbInformationExtractAgent = new Agent({
  name: "dbInformationExtractAgent",
  instructions: dbInformationExtractPrompt,
  // model: openai("gpt-4.1-nano"),
  model: gemini25FlashLite,
});

export default dbInformationExtractAgent;
