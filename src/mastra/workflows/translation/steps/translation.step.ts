import { createStep } from "@mastra/core";
import { z } from "zod";

const translationStep = createStep({
  id: "translationStep",
  inputSchema: z.object({
    evaluationReport: z.string(),
    targetLanguage: z.string(),
  }),
  outputSchema: z.object({
    translatedReport: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const translatorAgent = mastra.getAgent("translatorAgent");

    console.log("RUNNING translationStep");
    console.log("Target Language:", inputData.targetLanguage);

    const result = await translatorAgent.generate([
      {
        role: "user",
        content: `Target Language: ${inputData.targetLanguage}\n\nText to Translate:\n${inputData.evaluationReport}`,
      },
    ]);

    console.log("FINISHED translationStep");
    console.log("Translation result text length:", result.text?.length || 0);

    return {
      translatedReport: result.text || "",
    };
  },
});

export default translationStep;

