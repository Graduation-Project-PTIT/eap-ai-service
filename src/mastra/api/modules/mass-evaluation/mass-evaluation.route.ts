import { registerApiRoute } from "@mastra/core/server";
import createBatchHandler from "./handlers/create-batch.handler";
import getBatchesHandler from "./handlers/get-batches.handler";
import getBatchTasksHandler from "./handlers/get-batch-tasks.handler";
import getBatchHandler from "./handlers/get-batch.handler";
import clearSlotsHandler from "./handlers/clear-slots.handler";
import getStatsHandler from "./handlers/get-slots-stats.handler";

export const createMassEvaluationBatchRoute = registerApiRoute(
  "/mass-evaluation/batches",
  {
    method: "POST",
    handler: createBatchHandler,
  }
);

export const getMassEvaluationBatchesRoute = registerApiRoute(
  "/mass-evaluation/batches",
  {
    method: "GET",
    handler: getBatchesHandler,
  }
);

export const getBatchTasksRoute = registerApiRoute(
  "/mass-evaluation/batches/:batchId/tasks",
  {
    method: "GET",
    handler: getBatchTasksHandler,
  }
);

export const getBatchRoute = registerApiRoute(
  "/mass-evaluation/batches/:batchId",
  {
    method: "GET",
    handler: getBatchHandler,
  }
);

export const getStatsRoute = registerApiRoute("/mass-evaluation/stats", {
  method: "GET",
  handler: getStatsHandler,
});

export const clearSlotsRoute = registerApiRoute(
  "/mass-evaluation/clear-slots",
  {
    method: "GET",
    handler: clearSlotsHandler,
  }
);

export default [
  createMassEvaluationBatchRoute,
  getMassEvaluationBatchesRoute,
  getBatchTasksRoute,
  getBatchRoute,
  getStatsRoute,
  clearSlotsRoute,
];
