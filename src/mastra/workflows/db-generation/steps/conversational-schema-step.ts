import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import { createSchemaGenerationPrompt } from "../../../agents/db-generation/prompts/schema-generation-prompt";
/**
 * Conversational Schema Step
 *
 * This step handles both schema creation and modification using agent memory.
 * The agent automatically retrieves conversation history and working memory,
 * eliminating the need for manual schema passing.
 *
 * Key Features:
 * - Uses threadId and resourceId for memory context
 * - Agent automatically accesses conversation history
 * - Working memory stores current schema state
 * - Dynamic prompt generation based on enableSearch flag (prevents malformed tool calls)
 */
const conversationalSchemaStep = createStep({
  id: "conversationalSchemaStep",

  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    userMessage: z.string().min(1),
    enableSearch: z.boolean().optional().default(true),
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
    console.log(`⚠️  Search enabled flag IGNORED (tools incompatible with structured output)`);

    // Start performance timing
    const startTime = Date.now();

    try {
      // Always use NO-SEARCH prompt since structured output disables tools
      const dynamicPrompt = createSchemaGenerationPrompt(false);

      // Prepare agent options
      const agentOptions: any = {
        // Override agent instructions with context-aware prompt
        instructions: dynamicPrompt,

        // Memory context - agent uses this to retrieve conversation history
        memory: {
          resource: inputData.resourceId,
          thread: inputData.threadId,
        },
        
        // Use structured output with Zod schema to ensure valid JSON
        // NOTE: This DISABLES tool calling - tools cannot be used with structured output
        output: erdInformationGenerationSchema,
      };

      console.log(`🔧 Using STRUCTURED OUTPUT mode (tools disabled)`);
      console.log(`⚠️  Search tools are NOT available in this mode`);

      // Call the agent with memory context and structured output
      // The agent will automatically:
      // 1. Retrieve conversation history (last 20 messages) - contains all previous schemas
      // 2. Return validated JSON response matching the Zod schema
      // 3. CANNOT call search tools (structured output disables tool calling)
      const result = await agent.generate(inputData.userMessage, agentOptions);

      const duration = Date.now() - startTime;
      console.log(`⏱️  Schema generation took: ${duration}ms`);

      // With structured output, we get validated object directly
      // No need for complex text parsing or JSON.parse()
      const resultWithObject = result as any;
      if (!resultWithObject.object) {
        throw new Error("Agent failed to generate structured response");
      }

      const parsedResponse = resultWithObject.object as {
        entities: any[];
        explanation: string;
      };

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
