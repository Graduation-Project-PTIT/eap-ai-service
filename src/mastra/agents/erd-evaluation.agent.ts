import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";
import { claudeSonnet45 } from "../models/anthropic";

const erdEvaluationAgent = new Agent({
  name: "erdEvaluationAgent",
  instructions: erdEvaluationPrompt,
  model: claudeSonnet45,
});

export default erdEvaluationAgent;
