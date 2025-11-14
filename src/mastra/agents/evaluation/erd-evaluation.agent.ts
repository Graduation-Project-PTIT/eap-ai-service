import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";
import { gemini25FlashLite } from "../../models/google";

const erdEvaluationAgent = new Agent({
  name: "erdEvaluationAgent",
  instructions: erdEvaluationPrompt,
  model: gemini25FlashLite,
});

export default erdEvaluationAgent;
