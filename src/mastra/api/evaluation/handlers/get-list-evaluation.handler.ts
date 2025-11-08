import type { Context } from "hono";
import { db } from "../../db";
import { evaluationHistory } from "../../db/schema";
import { eq } from "drizzle-orm";

const getListEvaluationHandler = async (c: Context) => {
  const user = c.get("user");

  const evaluations = await db
    .select()
    .from(evaluationHistory)
    .where(eq(evaluationHistory.userId, user.sub));

  return c.json(evaluations);
};

export default getListEvaluationHandler;
