import type { Context } from "hono";
import {
  evaluationHistory,
  evaluationTranslationHistory,
} from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "../../../db";
import { MESSAGE } from "../../../constants/message";

const getTranslationResultHandler = async (c: Context) => {
  const { evaluationId } = c.req.param();
  const user = c.get("user");

  const evaluation = await db
    .select()
    .from(evaluationHistory)
    .where(
      and(
        eq(evaluationHistory.id, evaluationId),
        eq(evaluationHistory.userId, user.sub)
      )
    );

  if (!evaluation[0]) {
    return c.json({ error: MESSAGE.EVALUATION_NOT_FOUND }, 404);
  }

  const translation = await db
    .select()
    .from(evaluationTranslationHistory)
    .where(eq(evaluationTranslationHistory.evaluationId, evaluation[0].id));

  if (!translation[0]) {
    return c.json({ error: "Somthing went wrong. Please try again." }, 404);
  }

  const mastra = c.get("mastra");
  const workflow = mastra.getWorkflow("translationWorkflow");

  const executionResult = await workflow.getWorkflowRunExecutionResult(
    translation[0].workflowRunId
  );

  return c.json(executionResult, 200);
};

export default getTranslationResultHandler;
