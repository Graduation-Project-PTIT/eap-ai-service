import { createStep } from "@mastra/core";
import { z } from "zod";
import erdInformationExtractSchema from "../../../../schemas/erdInformationExtractSchema";
import { fetchAuthenticatedImage } from "../../../utils/imageFetcher";

const erdInformationExtractStep = createStep({
  id: "erdInformationExtractStep",
  inputSchema: z.object({
    erdImage: z.string().url(),
    userToken: z.string().optional(),
  }),
  outputSchema: erdInformationExtractSchema,
  execute: async ({ inputData, mastra }) => {
    const erdInformationExtractAgent = mastra.getAgent(
      "erdInformationExtractAgent"
    );

    try {
      // Fetch image with authentication
      const imageData = await fetchAuthenticatedImage(
        inputData.erdImage,
        inputData.userToken
      );

      const result = await erdInformationExtractAgent.generate(
        [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: `data:image/jpeg;base64,${imageData.buffer.toString("base64")}`,
                mimeType: imageData.mimeType,
              },
            ],
          },
        ],
        {
          output: erdInformationExtractSchema,
        }
      );

      return result.object;
    } catch (error: any) {
      console.error("Error in ERD information extract step:", error);
      throw new Error(`Failed to extract ERD information: ${error.message}`);
    }
  },
});

export default erdInformationExtractStep;
