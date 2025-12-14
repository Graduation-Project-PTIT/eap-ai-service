import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";

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
    userMessage: z.string().min(1).describe("The user's current message"),
    fullContext: z.string().describe("Full context including schema + history"),
    domain: z.string().nullable(),
    schemaContext: z.string().nullable(),
    conversationHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
      .optional(),
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
    const { fullContext } = inputData;
    const agent = mastra.getAgent("sideQuestionAgent");

    console.log(
      `💬 Handling side question with full context (${fullContext.length} chars)`
    );

    try {
      // Note: Memory is disabled - context is provided manually in the message
      console.log(`💬 Answering side question`);

      // Generate response using full context
      const result = await agent.generate(fullContext);

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
