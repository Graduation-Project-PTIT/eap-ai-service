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
    evaluationReport: z.string(),
    score: z.number().min(0).max(100),
  }),
  execute: async ({ inputData, mastra }) => {
    const erdEvaluationAgent = mastra.getAgent("erdEvaluationAgent");

    console.log("RUNNING erdEvaluationStep");

    const result = await erdEvaluationAgent.generate(
      [
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
      ],
      {
        output: z.object({
          evaluationReport: z.string(),
          score: z.number().min(0).max(100),
        }),
      }
    );

    console.log("FINISHED erdEvaluationStep");

    return {
      evaluationReport: result.object.evaluationReport,
      score: result.object.score,
    };
  },
});

export default erdEvaluationStep;
