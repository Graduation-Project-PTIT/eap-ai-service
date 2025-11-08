import { registerApiRoute } from "@mastra/core/server";
import { redisConcurrencyManager } from "../../utils/redis-concurrency-manager";
import axios from "axios";

/**
 * POST /mass-evaluation/start
 *
 * Starts a mass evaluation task
 * - Validates input
 * - Acquires concurrency slot (waits if needed)
 * - Starts evaluationSyncWorkflow
 * - Returns immediately with runId
 * - Calls back to backend when complete
 */
export const massEvaluationStartRoute = registerApiRoute(
  "/mass-evaluation/start",
  {
    method: "POST",
    handler: async (c) => {
      try {
        const mastra = c.get("mastra");
        const body = await c.req.json();

        const {
          taskId,
          batchId,
          fileUrl,
          questionDescription,
          userToken,
          callbackUrl,
        } = body;

        // Validate required fields
        if (
          !taskId ||
          !batchId ||
          !fileUrl ||
          !questionDescription ||
          !callbackUrl
        ) {
          return c.json(
            {
              success: false,
              error:
                "Missing required fields: taskId, batchId, fileUrl, questionDescription, callbackUrl",
            },
            400
          );
        }

        console.log(
          `[Mass Evaluation] Starting task ${taskId} for batch ${batchId}`
        );

        // Start async processing (don't await)
        processEvaluationTask({
          taskId,
          batchId,
          fileUrl,
          questionDescription,
          userToken,
          callbackUrl,
          mastra,
        }).catch((error) => {
          console.error(
            `[Mass Evaluation] Error processing task ${taskId}:`,
            error
          );
        });

        // Return immediately
        return c.json({
          success: true,
          taskId,
          status: "started",
          message: "Evaluation task started",
        });
      } catch (error: any) {
        console.error("[Mass Evaluation] Error in start route:", error);
        return c.json(
          {
            success: false,
            error: error.message || "Internal server error",
          },
          500
        );
      }
    },
  }
);

/**
 * Process evaluation task asynchronously
 */
async function processEvaluationTask(params: {
  taskId: string;
  batchId: string;
  fileUrl: string;
  questionDescription: string;
  userToken?: string;
  callbackUrl: string;
  mastra: any;
}) {
  const {
    taskId,
    fileUrl,
    questionDescription,
    userToken,
    callbackUrl,
    mastra,
  } = params;
  let runId: string | undefined;

  try {
    // Acquire concurrency slot (will wait if limit reached)
    console.log(`[Task ${taskId}] Acquiring concurrency slot...`);
    await redisConcurrencyManager.acquire(taskId);
    console.log(`[Task ${taskId}] Slot acquired, starting workflow...`);

    // Get the workflow
    const workflow = mastra.getWorkflow("evaluationSyncWorkflow");

    if (!workflow) {
      throw new Error("evaluationSyncWorkflow not found");
    }

    // Create workflow run
    const run = await workflow.createRunAsync();
    runId = run.runId;

    console.log(`[Task ${taskId}] Workflow run created: ${runId}`);

    // Start workflow with inputData (using correct Mastra API)
    const workflowOutput = await run.start({
      inputData: {
        erdImage: fileUrl,
        questionDescription,
        userToken,
        preferredFormat: "mermaid", // Fixed format for mass evaluation
      },
    });

    console.log(
      `[Task ${taskId}] Workflow completed with status: ${workflowOutput.status}`
    );

    // Check if workflow succeeded
    if (workflowOutput.status === "success" && workflowOutput.result) {
      // Extract result from workflow output
      const result = workflowOutput.result;

      // Release concurrency slot
      await redisConcurrencyManager.release(taskId);

      // Call back to backend with success
      await sendCallback(callbackUrl, {
        taskId,
        runId,
        status: "completed",
        result: {
          score: result.score,
          evaluationReport: result.evaluationReport,
        },
      });

      console.log(`[Task ${taskId}] Callback sent successfully`);
    } else {
      // Workflow failed
      throw new Error(
        `Workflow failed with status: ${workflowOutput.status}. ` +
          `Error: ${workflowOutput.error || "Unknown error"}`
      );
    }
  } catch (error: any) {
    console.error(`[Task ${taskId}] Error:`, error);

    // Release concurrency slot on error
    await redisConcurrencyManager.release(taskId);

    // Call back to backend with error
    // Only include runId if it was created (must be a valid UUID)
    const callbackData: any = {
      taskId,
      status: "failed",
      error: error.message || "Unknown error",
    };

    if (runId) {
      callbackData.runId = runId;
    }

    await sendCallback(callbackUrl, callbackData);
  }
}

/**
 * Send callback to backend
 */
async function sendCallback(callbackUrl: string, data: any) {
  try {
    await axios.post(callbackUrl, data, {
      timeout: 10000, // 10 seconds
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("[Mass Evaluation] Failed to send callback:", error.message);
    // Don't throw - we don't want to fail the task if callback fails
  }
}

/**
 * GET /mass-evaluation/stats
 *
 * Returns current concurrency statistics
 */
export const massEvaluationStatsRoute = registerApiRoute(
  "/mass-evaluation/stats",
  {
    method: "GET",
    handler: async (c) => {
      try {
        const stats = await redisConcurrencyManager.getStats();
        return c.json({
          success: true,
          stats,
        });
      } catch (error: any) {
        console.error("[Mass Evaluation] Error getting stats:", error);
        return c.json(
          {
            success: false,
            error: error.message || "Internal server error",
          },
          500
        );
      }
    },
  }
);
