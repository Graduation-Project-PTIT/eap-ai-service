import { createStep } from "@mastra/core";
import { z } from "zod";
import dbInformationExtractSchema from "../../../../schemas/dbInformationExtractSchema";
import { fetchAuthenticatedImage } from "../../../utils/imageFetcher";

const dbInformationExtractStep = createStep({
  id: "dbInformationExtractStep",
  inputSchema: z.object({
    erdImage: z.string().url(),
    userToken: z.string().optional(),
  }),
  outputSchema: dbInformationExtractSchema,
  execute: async ({ inputData, mastra }) => {
    const dbInformationExtractAgent = mastra.getAgent(
      "dbInformationExtractAgent"
    );

    try {
      // Fetch image with authentication
      const imageData = await fetchAuthenticatedImage(
        inputData.erdImage,
        inputData.userToken
      );

      const result = await dbInformationExtractAgent.generate(
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
          output: dbInformationExtractSchema,
        }
      );

      return result.object;
    } catch (error: any) {
      console.error("Error in ERD information extract step:", error);
      throw new Error(`Failed to extract ERD information: ${error.message}`);
    }
  },
});

export default dbInformationExtractStep;
