import type { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory, massEvaluationBatch } from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { MESSAGE } from "../../../constants/message";
import { redisConcurrencyManager } from "../utils/redis-concurrency-manager";

class MassEvaluationService {
  async processEvaluationTask(batchId: string, taskId: string, c: Context) {
    const user = c.get("user");

    const batch = await db
      .select()
      .from(massEvaluationBatch)
      .where(
        and(
          eq(massEvaluationBatch.id, batchId),
          eq(massEvaluationBatch.createdBy, user.sub)
        )
      );

    if (!batch[0]) {
      return c.json({ error: MESSAGE.BATCH_NOT_FOUND }, 404);
    }

    const task = await db
      .select()
      .from(evaluationHistory)
      .where(
        and(
          eq(evaluationHistory.id, taskId),
          eq(evaluationHistory.batchId, batchId)
        )
      );

    if (!task[0]) {
      return c.json({ error: MESSAGE.TASK_NOT_FOUND }, 404);
    }

    // Start processing task
    try {
      // Acquire concurrency slot (will wait if limit reached)
      console.log(`[Task ${taskId}] Acquiring concurrency slot...`);
      await redisConcurrencyManager.acquire(taskId);
      console.log(`[Task ${taskId}] Slot acquired, starting workflow...`);

      const mastra = c.get("mastra");
      const workflow = mastra.getWorkflow("dbEvaluationSyncWorkflow");
      const run = await workflow.createRunAsync({});

      // Update database
      await db
        .update(evaluationHistory)
        .set({ status: "processing", workflowRunId: run.id })
        .where(eq(evaluationHistory.id, taskId));

      const fileServiceURL =
        process.env.FILE_SERVICE_URL || "http://localhost:8081";
      const fileUrl = `${fileServiceURL}/api/files/${task[0].fileKey}/render`;

      const workflowOutput = await run.start({
        inputData: {
          erdImage: fileUrl,
          questionDescription: task[0].questionDescription,
          userToken: c.req.header("Authorization")?.replace("Bearer ", ""),
          preferredFormat: "mermaid",
        },
      });

      // Check if workflow succeeded
      if (workflowOutput.status === "success" && workflowOutput.result) {
        // Extract result from workflow output
        const result = workflowOutput.result;

        // Update datbase
        await db
          .update(evaluationHistory)
          .set({
            status: "completed",
            score: result.score,
            evaluationReport: result.evaluationReport,
          })
          .where(eq(evaluationHistory.id, taskId));
      } else {
        // Workflow failed
        await db
          .update(evaluationHistory)
          .set({
            status: "failed",
          })
          .where(eq(evaluationHistory.id, taskId));
      }
    } catch (error) {
      console.error(`[Task ${taskId}] Error:`, error);
    }

    // Release concurrency slot
    await redisConcurrencyManager.release(taskId);

    return c.json({ message: MESSAGE.TASK_STARTED });
  }
}

export const massEvaluationService = new MassEvaluationService();
