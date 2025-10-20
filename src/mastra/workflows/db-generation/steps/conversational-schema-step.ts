import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
/**
 * Conversational Schema Step
 *
 * This step handles both schema creation and modification using agent memory.
 * The agent automatically retrieves conversation history and working memory,
 * eliminating the need for manual schema passing.
 *
 * Key Changes:
 * - Uses threadId and resourceId for memory context
 * - Agent automatically accesses conversation history
 * - Working memory stores current schema state
 */
const conversationalSchemaStep = createStep({
  id: "conversationalSchemaStep",

  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    userMessage: z.string().min(1),
  }),

  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    updatedSchema: erdInformationGenerationSchema,
    agentResponse: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("conversationalSchemaAgent");

    console.log(`🔄 Processing conversation`);
    console.log(`🧵 Thread ID: ${inputData.threadId}`);
    console.log(`📦 Resource ID: ${inputData.resourceId}`);
    console.log(`📝 User message: ${inputData.userMessage}`);

    // Start performance timing
    const startTime = Date.now();

    try {
      // Call the agent with memory context and structured output
      // The agent will automatically:
      // 1. Retrieve conversation history (last 20 messages)
      // 2. Access working memory (current schema state)
      // 3. Use semantic recall for relevant past discussions
      const result = await agent.generate(inputData.userMessage, {
        // Memory context - agent uses this to retrieve conversation history
        memory: {
          resource: inputData.resourceId,
          thread: inputData.threadId,
        },
        // Use structured output with schema validation
        output: z.object({
          entities: erdInformationGenerationSchema.shape.entities,
          explanation: z.string(),
        }),
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️  Schema generation took: ${duration}ms`);

      // Access the structured object response
      if (!result.object) {
        throw new Error("Agent failed to generate schema");
      }

      const parsedResponse = result.object;

      console.log(`✅ Schema generated successfully`);
      console.log(
        `📋 Entities: ${parsedResponse.entities
          .map((e: any) => e.name)
          .join(", ")}`
      );

      return {
        threadId: inputData.threadId,
        resourceId: inputData.resourceId,
        updatedSchema: { entities: parsedResponse.entities },
        agentResponse: parsedResponse.explanation,
      };
    } catch (error) {
      console.error("❌ Failed to generate schema:", error);
      throw new Error(
        `Agent response generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

export default conversationalSchemaStep;
