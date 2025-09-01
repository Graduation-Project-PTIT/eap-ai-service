import { Agent } from "@mastra/core/agent";
import erdInformationExtractPrompt from "./prompts/erd-information-extract.prompt";
import { gpt5Nano } from "../models/openai";

const erdInformationExtractAgent = new Agent({
  name: "erdInformationExtractAgent",
  instructions: erdInformationExtractPrompt,
  // model: openai("gpt-4.1-nano"),
  model: gpt5Nano,
});

export default erdInformationExtractAgent;
