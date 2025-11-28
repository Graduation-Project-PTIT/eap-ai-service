import { registerApiRoute } from "@mastra/core/server";
import crateEvaluationHandler from "./handlers/create-evaluation.handler";
import getEvaluationHandler from "./handlers/get-evaluation.handler";
import getEvaluationResult from "./handlers/get-evaluation-result.handler";
import sendFinishRefinementEvent from "./handlers/send-finish-refinement-event.handler";
import getListEvaluationHandler from "./handlers/get-list-evaluation.handler";
import streamEvaluationHandler from "./handlers/stream-evaluation.handler";

export const createEvaluationRoute = registerApiRoute("/ai/evaluations", {
  method: "POST",
  handler: crateEvaluationHandler,
});

export const getListEvaluationRoute = registerApiRoute("/ai/evaluations", {
  method: "GET",
  handler: getListEvaluationHandler,
});

export const getEvaluationRoute = registerApiRoute(
  "/ai/evaluations/:evaluationId",
  {
    method: "GET",
    handler: getEvaluationHandler,
  }
);

export const getEvaluationResultRoute = registerApiRoute(
  "/ai/evaluations/:evaluationId/result",
  {
    method: "GET",
    handler: getEvaluationResult,
  }
);

export const sendFinishRefinementEventRoute = registerApiRoute(
  "/ai/evaluations/:evaluationId/finish-refinement",
  {
    method: "POST",
    handler: sendFinishRefinementEvent,
  }
);

export const streamEvaluationRoute = registerApiRoute(
  "/ai/evaluations/stream",
  {
    method: "POST",
    handler: streamEvaluationHandler,
  }
);

export default [
  createEvaluationRoute,
  getListEvaluationRoute,
  getEvaluationRoute,
  getEvaluationResultRoute,
  sendFinishRefinementEventRoute,
  streamEvaluationRoute,
];
