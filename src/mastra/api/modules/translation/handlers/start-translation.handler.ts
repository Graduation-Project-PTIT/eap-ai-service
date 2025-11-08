import type { Context } from "hono";
import { StartTranslationInput } from "../types/start-translation.input";
import { db } from "../../../db";
import {
  evaluationHistory,
  evaluationTranslationHistory,
} from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { MESSAGE } from "../../../constants/message";
import { Workflow } from "@mastra/core";

const startTranslationHandler = async (c: Context) => {
  const { evaluationId } = c.req.param();
  const body = await c.req.json<StartTranslationInput>();
  const user = c.get("user");
  const mastra = c.get("mastra");

  const evalaution = await db
    .select()
    .from(evaluationHistory)
    .where(
      and(
        eq(evaluationHistory.id, evaluationId),
        eq(evaluationHistory.userId, user.sub)
      )
    );

  if (!evalaution[0]) {
    return c.json({ error: MESSAGE.EVALUATION_NOT_FOUND }, 404);
  }

  const workflow: Workflow = mastra.getWorkflow("translationWorkflow");
  const run = await workflow.createRunAsync();

  run.start({
    inputData: {
      evaluationReport: body.evaluationReport,
      targetLanguage: body.targetLanguage,
    },
  });

  const translation = await db
    .insert(evaluationTranslationHistory)
    .values({
      evaluationId,
      targetLanguage: body.targetLanguage,
      workflowRunId: run.runId,
      status: "running",
    })
    .returning();

  return c.json(translation[0], 201);
};

export default startTranslationHandler;
