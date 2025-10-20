import { Agent } from "@mastra/core/agent";
import erdInformationExtractPrompt from "./prompts/erd-information-extract.prompt";
import { gemini25FlashLite } from "../../models/google";

const erdInformationExtractAgent = new Agent({
  name: "erdInformationExtractAgent",
  instructions: erdInformationExtractPrompt,
  // model: openai("gpt-4.1-nano"),
  model: gemini25FlashLite,
});

export default erdInformationExtractAgent;
