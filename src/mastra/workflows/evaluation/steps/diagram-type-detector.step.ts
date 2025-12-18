import { createStep } from "@mastra/core";
import { z } from "zod";
import { fetchAuthenticatedImage } from "../../../utils/imageFetcher";

/**
 * Diagram Type Detector Step
 *
 * Analyzes an uploaded image to determine if it's an ERD (Chen notation)
 * or a Physical Database diagram. This step is used to branch the workflow
 * to the appropriate extraction and evaluation path.
 */
const diagramTypeDetectorStep = createStep({
  id: "diagramTypeDetectorStep",
  inputSchema: z.object({
    erdImage: z.string().url(),
    userToken: z.string().optional(),
  }),
  outputSchema: z.object({
    diagramType: z.enum(["ERD", "PHYSICAL_DB"]),
    confidence: z.number().min(0).max(1).optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const diagramTypeDetectorAgent = mastra.getAgent(
      "diagramTypeDetectorAgent"
    );

    try {
      console.log("RUNNING diagramTypeDetectorStep");

      // Fetch image with authentication
      const imageData = await fetchAuthenticatedImage(
        inputData.erdImage,
        inputData.userToken
      );

      const result = await diagramTypeDetectorAgent.generate(
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
          output: z.object({
            diagramType: z.enum(["ERD", "PHYSICAL_DB"]),
            confidence: z.number().min(0).max(1).optional(),
          }),
        }
      );

      console.log("Detected diagram type:", result.object.diagramType);
      console.log("Confidence:", result.object.confidence);

      return {
        diagramType: result.object.diagramType,
        confidence: result.object.confidence,
      };
    } catch (error: any) {
      console.error("Error in diagram type detector step:", error);
      return {
        diagramType: "PHYSICAL_DB" as const,
        confidence: 0,
      };
    }
  },
});

export default diagramTypeDetectorStep;
