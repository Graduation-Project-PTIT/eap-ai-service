import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";
import { gemini25Flash } from "../models/google";

const erdEvaluationAgent = new Agent({
  name: "erdEvaluationAgent",
  instructions: erdEvaluationPrompt,
  model: gemini25Flash,
});

export default erdEvaluationAgent;
