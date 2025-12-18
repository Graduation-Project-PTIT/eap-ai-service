import type { Context } from "hono";
import { db } from "../../../db";
import { evaluationHistory } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { MESSAGE } from "../../../constants/message";
import { EVALUATION_MODE } from "../../../constants/evaluation-type";
import { getEvaluationWorkflowByMode } from "../utils/getEvaluationWorkflowMode";

// Type definitions for workflow steps
type DiagramType = "ERD" | "PHYSICAL_DB";

interface WorkflowStepResult {
  status: string;
  output?: {
    diagramType?: DiagramType;
    entities?: unknown[];
    relationships?: unknown[];
    ddlScript?: string;
    mermaidDiagram?: string;
    score?: number;
    evaluationReport?: string;
  };
}

interface WorkflowExecutionResult {
  status: string;
  result?: {
    score?: number;
    evaluationReport?: string;
    diagramType?: DiagramType;
    extractedInformation?: unknown;
  };
  steps?: Record<string, WorkflowStepResult>;
}

const getEvaluationResult = async (c: Context) => {
  const user = c.get("user");
  const mastra = c.get("mastra");

  const { evaluationId } = c.req.param();

  const evaluationQueryResult = await db
    .select()
    .from(evaluationHistory)
    .where(eq(evaluationHistory.id, evaluationId));

  if (!evaluationQueryResult[0]) {
    return c.json({ error: MESSAGE.EVALUATION_NOT_FOUND }, 404);
  }

  const evaluation = evaluationQueryResult[0];

  if (evaluation.userId !== user.sub) {
    return c.json({ error: MESSAGE.PERMISSION_DENIED }, 403);
  }

  // Use the workflow mode from the evaluation record
  const workflow = getEvaluationWorkflowByMode(
    evaluation.workflowMode || EVALUATION_MODE.STANDARD,
    mastra
  );

  const executionResult = (await workflow.getWorkflowRunExecutionResult(
    evaluation.workflowRunId!
  )) as WorkflowExecutionResult | undefined;

  if (executionResult?.status === "success" && executionResult?.result) {
    // Extract diagramType from result if available
    const diagramType = executionResult.result.diagramType;

    await db
      .update(evaluationHistory)
      .set({
        status: "completed",
        score: executionResult.result.score,
        evaluationReport: executionResult.result.evaluationReport,
        ...(diagramType && { diagramType }),
      })
      .where(eq(evaluationHistory.id, evaluationId));
  } else if (executionResult?.status === "waiting" && executionResult?.steps) {
    // When workflow is waiting, check if we have extraction results in steps
    // Handle both ERD and Physical DB extraction steps
    const steps = executionResult.steps;

    // Check for diagram type detector step first
    const detectorStep = steps["diagramTypeDetectorStep"];
    let diagramType: DiagramType | undefined;
    if (
      detectorStep?.status === "success" &&
      detectorStep.output?.diagramType
    ) {
      diagramType = detectorStep.output.diagramType;
    }

    // Check for ERD extraction step
    const erdExtractStep = steps["erdInformationExtractStep"];
    if (erdExtractStep?.status === "success" && erdExtractStep.output) {
      diagramType = diagramType || "ERD";
      await db
        .update(evaluationHistory)
        .set({
          extractedInformation: erdExtractStep.output,
          diagramType,
        })
        .where(eq(evaluationHistory.id, evaluationId));
    }

    // Check for Physical DB extraction step
    const dbExtractStep = steps["dbInformationExtractStep"];
    if (dbExtractStep?.status === "success" && dbExtractStep.output) {
      diagramType = diagramType || "PHYSICAL_DB";
      await db
        .update(evaluationHistory)
        .set({
          extractedInformation: dbExtractStep.output,
          diagramType,
        })
        .where(eq(evaluationHistory.id, evaluationId));
    }
  }

  return c.json(executionResult, 200);
};

export default getEvaluationResult;
