import { Agent } from "@mastra/core/agent";
import erdInformationExtractPrompt from "./prompts/erd-information-extract.prompt";
import { gemini25FlashLite } from "../../models/google";

/**
 * ERD Information Extract Agent
 *
 * Specialized agent for extracting information from Chen notation ERD images.
 * Identifies entities (including weak entities), attributes (including multivalued,
 * derived, composite), and relationships with participation constraints.
 */
const erdInformationExtractAgent = new Agent({
  name: "erdInformationExtractAgent",
  instructions: erdInformationExtractPrompt,
  model: gemini25FlashLite,
});

export default erdInformationExtractAgent;

