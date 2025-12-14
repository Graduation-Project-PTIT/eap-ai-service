import { Agent } from "@mastra/core/agent";
import dbEvaluationPrompt from "./prompts/db-evaluation.prompt";
import { gemini25FlashLite } from "../../models/google";

const dbEvaluationAgent = new Agent({
  name: "dbEvaluationAgent",
  instructions: dbEvaluationPrompt,
  model: gemini25FlashLite,
});

export default dbEvaluationAgent;
