import type { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";
import { eq, and, isNull } from "drizzle-orm";

const getListEvaluationHandler = async (c: Context) => {
  const user = c.get("user");

  const evaluations = await db
    .select()
    .from(evaluationHistory)
    .where(
      and(
        eq(evaluationHistory.userId, user.sub),
        isNull(evaluationHistory.batchId)
      )
    );

  return c.json(evaluations);
};

export default getListEvaluationHandler;
