import type { Context } from "hono";
import { db } from "../../../db";
import { massEvaluationBatch, evaluationHistory } from "../../../db/schema";
import {
  createBatchInput,
  CreateBatchInput,
} from "../types/create-batch.input";
import { massEvaluationService } from "../services/mass-evaluation.service";

const startBatchHandler = async (c: Context) => {
  const input = await c.req.json<CreateBatchInput>();
  const user = c.get("user");

  const validatedInput = createBatchInput.parse(input);

  const batch = await db
    .insert(massEvaluationBatch)
    .values({
      ...validatedInput,
      status: "pending",
      createdBy: user.sub,
    })
    .returning();

  const evaluationTasks = validatedInput.fileKeys.map((fileKey) => ({
    questionDescription: validatedInput.questionDescription,
    batchId: batch[0].id,
    fileKey,
    status: "pending",
    userId: user.sub,
    workflowMode: "sync",
    preferredFormat: "mermaid",
  }));

  const tasks = await db
    .insert(evaluationHistory)
    .values(evaluationTasks)
    .returning();

  for (const task of tasks) {
    // Start tasks processing in background
    massEvaluationService.processEvaluationTask(batch[0].id, task.id, c);
  }

  return c.json(batch[0], 201);
};

export default startBatchHandler;
