import { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { MESSAGE } from "../../../constants/message";
import { getEvaluationWorkflowByMode } from "../utils/getEvaluationWorkflowMode";
import { EVALUATION_MODE } from "../../../constants/evaluation-type";
import { SendFinishRefinementEvent } from "../types/send-finish-refinement-event.input";

const sendFinishRefinementEvent = async (c: Context) => {
  const user = c.get("user");
  const mastra = c.get("mastra");

  const body = await c.req.json<SendFinishRefinementEvent>();

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
  const run = await workflow.createRunAsync({
    runId: evaluation!.workflowRunId || "",
  });

  run.sendEvent(body.event, {
    extractedInformation: body.data.extractedInformation,
    diagramType: evaluation.diagramType,
  });

  return c.json({ success: true }, 200);
};

export default sendFinishRefinementEvent;
