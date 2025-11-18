import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";

/**
 * Side Question Handling Step
 *
 * This step handles general questions or off-topic queries.
 * It uses the side question agent to provide helpful responses
 * without memory (context is provided manually).
 */
const sideQuestionStep = createStep({
  id: "sideQuestionStep",

  inputSchema: z.object({
    userMessage: z
      .string()
      .min(1)
      .describe("The user's request or instruction"),
    intent: z.enum(["schema", "side-question"]),
    schemaIntent: z.enum(["create", "modify"]).nullable(),
    confidence: z.number(),
    enableSearch: z.boolean().optional().default(true),
  }),

  outputSchema: z.object({
    response: z.string().describe("The assistant's response"),
    updatedSchema: erdInformationGenerationSchema.optional(),
    ddlScript: z.string().optional(),
    agentResponse: z.string().optional(),
    isSideQuestion: z.boolean(),
    isSchemaGeneration: z.boolean(),
  }),

  execute: async ({ inputData, mastra }) => {
    const { userMessage } = inputData;
    const agent = mastra.getAgent("sideQuestionAgent");

    console.log(`💬 Handling side question: "${userMessage}"`);

    try {
      // Note: Memory is disabled - context is provided manually in the message
      console.log(`💬 Answering side question`);

      // Generate response without memory
      const result = await agent.generate(userMessage);

      const response = result.text;

      console.log(`✅ Side question answered (${response.length} chars)`);

      return {
        response,
        updatedSchema: undefined,
        ddlScript: undefined,
        agentResponse: undefined,
        isSideQuestion: true,
        isSchemaGeneration: false,
      };
    } catch (error) {
      console.error("❌ Side question handling error:", error);

      // Return a friendly error message
      return {
        response:
          "I apologize, but I encountered an error while processing your question. Please try again or rephrase your question.",
        updatedSchema: undefined,
        ddlScript: undefined,
        agentResponse: undefined,
        isSideQuestion: true,
        isSchemaGeneration: false,
      };
    }
  },
});

export default sideQuestionStep;
