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
      const diagramType = task[0].diagramType;
      const workflow = mastra.getWorkflow(
        diagramType === "ERD"
          ? "erdEvaluationSyncWorkflow"
          : "dbEvaluationSyncWorkflow"
      );
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
      if (workflowOutput.status === "success") {
        // Extract result from workflow output
        let result;

        if (workflowOutput?.result?.erdEvaluationStep) {
          result = workflowOutput.result.erdEvaluationStep;
        } else if (workflowOutput?.result?.dbEvaluationStep) {
          result = workflowOutput.result.dbEvaluationStep;
        }

        // Update database
        await db
          .update(evaluationHistory)
          .set({
            status: "completed",
            score: result.score,
            evaluationReport: result.evaluationReport,
          })
          .where(eq(evaluationHistory.id, taskId));

        // Get all tasks score of batch
        const tasks = await db
          .select({
            score: evaluationHistory.score,
          })
          .from(evaluationHistory)
          .where(eq(evaluationHistory.batchId, batchId));

        // Calculate average score
        const totalScore = tasks.reduce(
          (sum, task) => sum + (task.score || 0),
          0
        );
        const averageScore = totalScore / tasks.length;

        // Update batch
        await db
          .update(massEvaluationBatch)
          .set({
            status: "completed",
            averageScore: averageScore,
          })
          .where(eq(massEvaluationBatch.id, batchId));
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
