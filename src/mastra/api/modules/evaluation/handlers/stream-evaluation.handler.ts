import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";

import { getEvaluationWorkflowByMode } from "../utils/getEvaluationWorkflowMode";
import { EVALUATION_MODE } from "../../../constants/evaluation-type";
import { eq } from "drizzle-orm";
import {
  StreamEvaluationInput,
  streamEvaluationInputSchema,
} from "../types/stream-evaluation.input";

const streamEvaluationHandler = async (c: Context) => {
  const input = await c.req.json<StreamEvaluationInput>();
  console.log("START");
  const user = c.get("user");

  const validatedInput = streamEvaluationInputSchema.parse(input);

  const mastra = c.get("mastra");
  const workflow = getEvaluationWorkflowByMode(
    validatedInput.workflowMode || EVALUATION_MODE.STANDARD,
    mastra
  );

  const fileServiceURL =
    process.env.FILE_SERVICE_URL || "http://localhost:8081";
  const fileUrl = `${fileServiceURL}/api/files/${validatedInput.fileKey}/render`;

  // Case resume workflow
  if (typeof input.runId === "string") {
    return streamSSE(c, async (stream) => {
      const run = await workflow.createRunAsync({
        runId: input.runId,
      });

      const workflowStream = await run.resumeStreamVNext({
        resumeData: {
          approved: true,
        },
      });

      for await (const chunk of workflowStream) {
        stream.writeSSE({
          data: JSON.stringify(chunk),
        });
      }
    });
  }

  // Case create new workflow
  return streamSSE(c, async (stream) => {
    const run = await workflow.createRunAsync();

    const workflowStream = await run.streamVNext({
      inputData: {
        isStream: true,
        questionDescription: validatedInput.questionDescription,
        erdImage: fileUrl,
        userToken: c.req.header("Authorization")?.replace("Bearer ", ""),
        preferredFormat: validatedInput.preferredFormat,
      },
    });

    // Store evaluation to db
    const evaluation = await db
      .insert(evaluationHistory)
      .values({
        ...validatedInput,
        userId: user.sub,
        workflowRunId: run.runId,
        status: "running",
      })
      .returning();

    for await (const chunk of workflowStream) {
      stream.writeSSE({
        data: JSON.stringify(chunk),
      });

      // Store extracted information to db
      if (
        chunk.type === "workflow-step-result" &&
        chunk.payload.id === "erdInformationExtractStep" &&
        chunk.payload.status === "success"
      ) {
        const data = chunk.payload!.output;

        await db
          .update(evaluationHistory)
          .set({
            extractedInformation: data,
          })
          .where(eq(evaluationHistory.id, evaluation[0].id));
      }

      // Store result to db
      if (
        chunk.type === "workflow-step-result" &&
        chunk.payload.id === "erdEvaluationStep" &&
        chunk.payload.status === "success"
      ) {
        const data = chunk.payload!.output;

        await db
          .update(evaluationHistory)
          .set({
            status: "completed",
            score: data!.score,
            evaluationReport: data!.evaluationReport,
          })
          .where(eq(evaluationHistory.id, evaluation[0].id));
      }
    }
  });
};

export default streamEvaluationHandler;
