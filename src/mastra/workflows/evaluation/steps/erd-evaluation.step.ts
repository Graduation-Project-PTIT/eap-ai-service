import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import erdInformationExtractSchema from "../../../../schemas/erdInformationExtractSchema";

/**
 * ERD Evaluation Step
 *
 * Evaluates a Chen notation ERD against the problem description.
 * Focuses on:
 * - Entity classification (strong vs weak)
 * - Attribute modeling (key, multivalued, derived, composite)
 * - Relationship modeling (cardinality, naming)
 * - Participation constraints (total vs partial)
 */
const erdEvaluationStep = createStep({
  id: "erdEvaluationStep",
  inputSchema: z.object({
    isStream: z.boolean().optional().default(false),
    questionDescription: z.string(),
    extractedInformation: erdInformationExtractSchema,
    preferredFormat: z.enum(["json", "mermaid"]).default("json"),
  }),
  outputSchema: z.object({
    evaluationReport: z.string(),
    score: z.number().min(0).max(100),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    const erdEvaluationAgent = mastra.getAgent("erdEvaluationAgent");

    console.log("RUNNING erdEvaluationStep");
    console.log("Preferred format:", inputData.preferredFormat);

    // Format the extracted data based on preference
    let formattedData: string;
    switch (inputData.preferredFormat) {
      case "json":
      default:
        formattedData = JSON.stringify(
          {
            entities: inputData.extractedInformation.entities,
            relationships: inputData.extractedInformation.relationships,
          },
          null,
          2
        );
        console.log("Using JSON format for evaluation");
        break;
    }

    if (!inputData.isStream) {
      console.log("GENERATE (non-streaming)");
      const result = await erdEvaluationAgent.generate(
        [
          { role: "user", content: inputData.questionDescription },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: formattedData,
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
    } else {
      console.log("STREAM");
      const stream = await erdEvaluationAgent.stream(
        [
          { role: "user", content: inputData.questionDescription },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: formattedData,
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

      for await (const chunk of stream.objectStream) {
        writer.write({
          data: JSON.stringify(chunk),
        });
      }

      console.log("FINISHED erdEvaluationStep (streaming)");

      return {
        evaluationReport: (await stream.object).evaluationReport,
        score: (await stream.object).score,
      };
    }
  },
});

export default erdEvaluationStep;
