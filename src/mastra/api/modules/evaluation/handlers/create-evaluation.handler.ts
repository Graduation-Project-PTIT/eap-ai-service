import { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";

import {
  CreateEvaluationInput,
  createEvaluationInputSchema,
} from "../types/create-evaluation.input";
import { getEvaluationWorkflowByMode } from "../utils/getEvaluationWorkflowMode";
import { EVALUATION_MODE } from "../../../constants/evaluation-type";

const crateEvaluationHandler = async (c: Context) => {
  const input = await c.req.json<CreateEvaluationInput>();
  const user = c.get("user");

  const validatedInput = createEvaluationInputSchema.parse(input);

  const mastra = c.get("mastra");
  const workflow = getEvaluationWorkflowByMode(
    validatedInput.workflowMode || EVALUATION_MODE.STANDARD,
    mastra
  );

  const run = await workflow.createRunAsync();

  const fileServiceURL =
    process.env.FILE_SERVICE_URL || "http://localhost:8081";
  const fileUrl = `${fileServiceURL}/api/files/${validatedInput.fileKey}/render`;

  run.start({
    inputData: {
      questionDescription: validatedInput.questionDescription,
      erdImage: fileUrl,
      userToken: c.req.header("Authorization")?.replace("Bearer ", ""),
      preferredFormat: validatedInput.preferredFormat,
    },
  });

  const evaluation = await db
    .insert(evaluationHistory)
    .values({
      ...validatedInput,
      userId: user.sub,
      workflowRunId: run.runId,
      status: "running",
    })
    .returning();

  return c.json(evaluation[0], 201);
};

export default crateEvaluationHandler;
