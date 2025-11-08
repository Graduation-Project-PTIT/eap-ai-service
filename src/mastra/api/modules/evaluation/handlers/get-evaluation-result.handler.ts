import type { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { MESSAGE } from "../../../constants/message";
import { EVALUATION_MODE } from "../../../constants/evaluation-type";
import { getEvaluationWorkflowByMode } from "../utils/getEvaluationWorkflowMode";

const getEvaluationResult = async (c: Context) => {
  const user = c.get("user");
  const mastra = c.get("mastra");

  const { evaluationId } = c.req.param();

  const evaluationQueryResult = await db
    .select()
    .from(evaluationHistory)
    .where(eq(evaluationHistory.id, evaluationId));

  if (!evaluationQueryResult[0]) {
    return c.json({ error: MESSAGE.EVALUATION_NOT_FOUND }, 404);
  }

  const evaluation = evaluationQueryResult[0];

  if (evaluation.userId !== user.sub) {
    return c.json({ error: MESSAGE.PERMISSION_DENIED }, 403);
  }

  // Use the workflow mode from the evaluation record
  const workflow = getEvaluationWorkflowByMode(
    evaluation.workflowMode || EVALUATION_MODE.STANDARD,
    mastra
  );

  const executionResult = await workflow.getWorkflowRunExecutionResult(
    evaluation.workflowRunId
  );

  if (executionResult?.status === "success") {
    await db
      .update(evaluationHistory)
      .set({ status: "completed" })
      .where(eq(evaluationHistory.id, evaluationId));
  }

  return c.json(executionResult, 200);
};

export default getEvaluationResult;
