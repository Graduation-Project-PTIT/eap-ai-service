import { createStep } from "@mastra/core";
import z from "zod";

/**
 * Intent Classification Step
 *
 * This step classifies the user's message intent:
 * - "schema": User wants to create/modify database schema
 * - "side-question": User has a general question or off-topic query
 *
 * The classification helps route the conversation to the appropriate handler.
 */
const intentClassificationStep = createStep({
  id: "intentClassificationStep",

  inputSchema: z.object({
    userMessage: z
      .string()
      .min(1)
      .describe("The user's request or instruction"),
    enableSearch: z
      .boolean()
      .optional()
      .default(true)
      .describe("Enable or disable web search tool for schema generation"),
  }),

  outputSchema: z.object({
    userMessage: z.string(),
    intent: z
      .enum(["schema", "side-question"])
      .describe("Classified intent of the user message"),
    schemaIntent: z
      .enum(["create", "modify"])
      .nullable()
      .describe("Sub-intent for schema operations: create new schema or modify existing"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence score of the classification"),
    enableSearch: z.boolean(),
  }),

  execute: async ({ inputData, mastra }) => {
    const { userMessage } = inputData;
    const agent = mastra.getAgent("intentClassificationAgent");

    console.log(`🎯 Classifying intent for message: "${userMessage}"`);

    try {
      // Use structured output for reliable classification
      const outputSchema = z.object({
        intent: z
          .enum(["schema", "side-question"])
          .describe("The classified intent"),
        schemaIntent: z
          .enum(["create", "modify"])
          .nullable()
          .describe(
            "For schema intent only: 'create' if creating new tables/entities, 'modify' if updating existing schema. Null for side-question."
          ),
        confidence: z
          .number()
          .min(0)
          .max(1)
          .describe("Confidence score of the classification"),
      });

      const result = await agent.generate(userMessage, {
        output: outputSchema,
      });

      const resultWithObject = result as any;

      if (!resultWithObject.object) {
        throw new Error("Agent failed to generate structured response");
      }

      const classification = resultWithObject.object as {
        intent: "schema" | "side-question";
        schemaIntent: "create" | "modify" | null;
        confidence: number;
      };

      console.log(
        `✅ Intent classified: ${classification.intent} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`
      );
      
      if (classification.schemaIntent) {
        console.log(`🔧 Schema intent: ${classification.schemaIntent}`);
      }

      return {
        userMessage,
        intent: classification.intent,
        schemaIntent: classification.schemaIntent || null,
        confidence: classification.confidence,
        enableSearch: inputData.enableSearch,
      };
    } catch (error) {
      console.error("❌ Intent classification error:", error);

      // Default to schema/create on error
      return {
        userMessage,
        intent: "schema" as const,
        schemaIntent: "create" as const,
        confidence: 0.5,
        enableSearch: inputData.enableSearch,
      };
    }
  },
});

export default intentClassificationStep;
