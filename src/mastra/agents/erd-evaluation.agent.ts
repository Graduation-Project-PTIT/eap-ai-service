import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";

const erdEvaluationAgent = new Agent({
  name: "erdEvaluationAgent",
  instructions: erdEvaluationPrompt,
  model: google("gemini-2.5-flash"),
});

export default erdEvaluationAgent;
