import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";
import { gemini25FlashLite } from "../../models/google";

/**
 * ERD Evaluation Agent
 *
 * Specialized agent for evaluating Chen notation ERD diagrams.
 * Evaluates based on:
 * - Entity classification (strong vs weak entities)
 * - Attribute modeling (key, multivalued, derived, composite)
 * - Relationship modeling (cardinality, naming)
 * - Participation constraints (total vs partial)
 */
const erdEvaluationAgent = new Agent({
  name: "erdEvaluationAgent",
  instructions: erdEvaluationPrompt,
  model: gemini25FlashLite,
});

export default erdEvaluationAgent;

