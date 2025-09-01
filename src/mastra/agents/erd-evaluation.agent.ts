import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";
import { gpt5Nano } from "../models/openai";

const erdEvaluationAgent = new Agent({
  name: "erdEvaluationAgent",
  instructions: erdEvaluationPrompt,
  model: gpt5Nano,
});

export default erdEvaluationAgent;
