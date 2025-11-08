import { registerApiRoute } from "@mastra/core/server";
import crateEvaluationHandler from "./handlers/create-evaluation.handler";
import getEvaluationHandler from "./handlers/get-evaluation.handler";
import getEvaluationResult from "./handlers/get-evaluation-result.handler";
import sendFinishRefinementEvent from "./handlers/send-finish-refinement-event.handler";
import getListEvaluationHandler from "./handlers/get-list-evaluation.handler";

export const createEvaluationRoute = registerApiRoute("/evaluations", {
  method: "POST",
  handler: crateEvaluationHandler,
});

export const getListEvaluationRoute = registerApiRoute("/evaluations", {
  method: "GET",
  handler: getListEvaluationHandler,
});

export const getEvaluationRoute = registerApiRoute(
  "/evaluations/:evaluationId",
  {
    method: "GET",
    handler: getEvaluationHandler,
  }
);

export const getEvaluationResultRoute = registerApiRoute(
  "/evaluations/:evaluationId/result",
  {
    method: "GET",
    handler: getEvaluationResult,
  }
);

export const sendFinishRefinementEventRoute = registerApiRoute(
  "/evaluations/:evaluationId/finish-refinement",
  {
    method: "POST",
    handler: sendFinishRefinementEvent,
  }
);

export default [
  createEvaluationRoute,
  getListEvaluationRoute,
  getEvaluationRoute,
  getEvaluationResultRoute,
  sendFinishRefinementEventRoute,
];
