import { registerApiRoute } from "@mastra/core/server";
import startTranslationHandler from "./handlers/start-translation.handler";
import getTranslationResultHandler from "./handlers/get-translation-result.handler";

const startTranslationRoute = registerApiRoute(
  "/ai/evaluations/:evaluationId/translation",
  {
    method: "POST",
    handler: startTranslationHandler,
  }
);

const getTranslationResultRoute = registerApiRoute(
  "/ai/evaluations/:evaluationId/translation/result",
  {
    method: "GET",
    handler: getTranslationResultHandler,
  }
);

export default [startTranslationRoute, getTranslationResultRoute];
