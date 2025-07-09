import { createStep } from "@mastra/core";
import { z } from "zod";
import erdInformationExtractSchema from "../../../../schemas/erdInformationExtractSchema";

const erdInformationExtractStep = createStep({
  id: "erdInformationExtractStep",
  inputSchema: z.object({
    erdImage: z.string().url(),
  }),
  outputSchema: erdInformationExtractSchema,
  execute: async ({ inputData, mastra }) => {
    const erdInformationExtractAgent = mastra.getAgent(
      "erdInformationExtractAgent"
    );

    const result = await erdInformationExtractAgent.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: new URL(inputData.erdImage),
              mimeType: "image/png",
            },
          ],
        },
      ],
      {
        output: erdInformationExtractSchema,
      }
    );

    return result.object;
  },
});

export default erdInformationExtractStep;
