import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import translationStep from "./steps/translation.step";

const translationWorkflow = createWorkflow({
  id: "translationWorkflow",
  inputSchema: z.object({
    evaluationReport: z.string(),
    targetLanguage: z.string(),
  }),
  outputSchema: z.object({
    translatedReport: z.string(),
  }),
})
  .then(translationStep)
  .commit();

export default translationWorkflow;

