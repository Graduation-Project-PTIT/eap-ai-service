import type { Context } from "hono";
import { db } from "../../../db";
import { massEvaluationBatch, evaluationHistory } from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { MESSAGE } from "../../../constants/message";

const getBatchTasksHandler = async (c: Context) => {
  const { batchId } = c.req.param();
  const user = c.get("user");

  // Verify batch exists and user has access
  const batchResult = await db
    .select()
    .from(massEvaluationBatch)
    .where(
      and(
        eq(massEvaluationBatch.id, batchId),
        eq(massEvaluationBatch.createdBy, user.sub)
      )
    );

  if (!batchResult[0]) {
    return c.json({ error: MESSAGE.BATCH_NOT_FOUND }, 404);
  }

  const batch = batchResult[0];

  // Get all tasks for this batch
  const tasks = await db
    .select()
    .from(evaluationHistory)
    .where(eq(evaluationHistory.batchId, batchId));

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const failedTasks = tasks.filter((t) => t.status === "failed").length;

  // Return batch with tasks and statistics
  return c.json({
    ...batch,
    totalTasks,
    completedTasks,
    failedTasks,
    tasks,
  });
};

export default getBatchTasksHandler;

