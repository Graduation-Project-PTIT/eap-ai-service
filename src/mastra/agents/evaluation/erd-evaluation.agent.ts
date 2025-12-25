import { Agent } from "@mastra/core/agent";
import erdEvaluationPrompt from "./prompts/erd-evaluation.prompt";
import { claudeHaiku45 } from "../../models/anthropic";

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
  model: claudeHaiku45,
});

export default erdEvaluationAgent;
