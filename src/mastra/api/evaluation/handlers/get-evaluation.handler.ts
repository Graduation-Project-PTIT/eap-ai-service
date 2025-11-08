import type { Context } from "hono";
import { db } from "../../db";
import { evaluationHistory } from "../../db/schema";
import { eq } from "drizzle-orm";

const getEvaluationHandler = async (c: Context) => {
  const { evaluationId } = c.req.param();

  const evaluation = await db
    .select()
    .from(evaluationHistory)
    .where(eq(evaluationHistory.id, evaluationId));

  if (!evaluation) {
    return c.json({ error: "Evaluation not found" }, 404);
  }

  return c.json(evaluation[0]);
};

export default getEvaluationHandler;
