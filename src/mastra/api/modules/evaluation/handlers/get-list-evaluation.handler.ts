import type { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

const getListEvaluationHandler = async (c: Context) => {
  const user = c.get("user");
  const limit = parseInt(c.req.query("limit") || "10");
  const offset = parseInt(c.req.query("offset") || "0");

  const evaluations = await db
    .select()
    .from(evaluationHistory)
    .where(
      and(
        eq(evaluationHistory.userId, user.sub),
        isNull(evaluationHistory.batchId)
      )
    )
    .limit(limit)
    .offset(offset)
    .orderBy(desc(evaluationHistory.createdAt));

  return c.json(evaluations);
};

export default getListEvaluationHandler;
