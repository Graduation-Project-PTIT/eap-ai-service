import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import erdInformationExtractSchema from "../../../../schemas/erdInformationExtractSchema";

const erdEvaluationStep = createStep({
  id: "erdEvaluationStep",
  inputSchema: z.object({
    isStream: z.boolean().optional().default(false),
    questionDescription: z.string(),
    extractedInformation: erdInformationExtractSchema,
    preferredFormat: z.enum(["json", "ddl", "mermaid"]).default("json"),
  }),
  outputSchema: z.object({
    evaluationReport: z.string(),
    score: z.number().min(0).max(100),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    const erdEvaluationAgent = mastra.getAgent("erdEvaluationAgent");

    console.log("RUNNING erdEvaluationStep");
    console.log("Preferred format:", inputData.preferredFormat);

    // Select the format based on user preference
    let formattedData: string;
    switch (inputData.preferredFormat) {
      case "ddl":
        formattedData = inputData.extractedInformation.ddlScript;
        console.log("Using DDL format for evaluation");
        break;
      case "mermaid":
        formattedData = inputData.extractedInformation.mermaidDiagram;
        console.log("Using Mermaid format for evaluation");
        break;
      case "json":
      default:
        formattedData = JSON.stringify(
          inputData.extractedInformation.entities,
          null,
          2
        );
        console.log("Using JSON format for evaluation");
        break;
    }

    if (!inputData.isStream) {
      console.log("GENERATE");
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
      console.log("WRITER", writer);
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

      // await stream.textStream.pipeTo(writer as WritableStream);

      console.log("FINISHED erdEvaluationStep");

      return {
        evaluationReport: (await stream.object).evaluationReport,
        score: (await stream.object).score,
      };
    }
  },
});

export default erdEvaluationStep;
