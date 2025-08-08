import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import erdInformationExtractPrompt from "./prompts/erd-information-extract.prompt";

const erdInformationExtractAgent = new Agent({
  name: "erdInformationExtractAgent",
  instructions: erdInformationExtractPrompt,
  // model: openai("gpt-4.1-nano"),
  model: google("gemini-2.5-flash"),
});

export default erdInformationExtractAgent;
