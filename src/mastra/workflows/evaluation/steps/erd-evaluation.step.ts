import { createStep } from "@mastra/core";
import { z } from "zod";
import erdInformationExtractSchema from "../../../../schemas/erdInformationExtractSchema";

const erdEvaluationStep = createStep({
  id: "erdEvaluationStep",
  inputSchema: z.object({
    questionDescription: z.string(),
    extractedInformation: erdInformationExtractSchema,
  }),
  outputSchema: z.object({
    extractedInformation: erdInformationExtractSchema,
    evaluationReport: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const erdEvaluationAgent = mastra.getAgent("erdEvaluationAgent");

    const result = await erdEvaluationAgent.generate([
      { role: "user", content: inputData.questionDescription },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify(inputData.extractedInformation),
          },
        ],
      },
    ]);

    return {
      extractedInformation: inputData.extractedInformation,
      evaluationReport: result.text,
    };
  },
});

export default erdEvaluationStep;
