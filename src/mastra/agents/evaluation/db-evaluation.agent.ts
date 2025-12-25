import { Agent } from "@mastra/core/agent";
import dbEvaluationPrompt from "./prompts/db-evaluation.prompt";
import { claudeHaiku45 } from "../../models/anthropic";

const dbEvaluationAgent = new Agent({
  name: "dbEvaluationAgent",
  instructions: dbEvaluationPrompt,
  model: claudeHaiku45,
});

export default dbEvaluationAgent;
