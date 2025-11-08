import { Mastra, Workflow } from "@mastra/core";
import { EVALUATION_MODE } from "../../../constants/evaluation-type";

export const getEvaluationWorkflowByMode = (
  mode: string,
  mastra: Mastra
): Workflow => {
  const isStandardEvaluationMode = mode === EVALUATION_MODE.STANDARD;

  const workflow = isStandardEvaluationMode
    ? mastra.getWorkflow("evaluationWorkflow")
    : mastra.getWorkflow("evaluationSyncWorkflow");

  return workflow;
};
