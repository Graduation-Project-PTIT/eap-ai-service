import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
/**
 * Conversational DDL Generation Step
 *
 * This step generates DDL script from an updated schema.
 * DDL generation is stateless, so it only needs the schema.
 */
const conversationalDdlGenerationStep = createStep({
  id: "conversationalDdlGenerationStep",

  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    updatedSchema: erdInformationGenerationSchema,
    agentResponse: z.string(),
  }),

  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    updatedSchema: erdInformationGenerationSchema,
    ddlScript: z.string(),
    agentResponse: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const ddlScriptGenerationAgent = mastra.getAgent(
      "ddlScriptGenerationAgent"
    );

    console.log(`🔨 Generating DDL script`);
    console.log(`🧵 Thread ID: ${inputData.threadId}`);

    // Start performance timing
    const startTime = Date.now();

    // Generate DDL script without structured output (plain SQL text)
    // DDL agent has memory but doesn't need it for SQL generation
    // Note: Not using 'output' parameter to avoid conflict with function calling
    const result = await ddlScriptGenerationAgent.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify(inputData.updatedSchema),
            },
          ],
        },
      ],
      {
        memory: {
          resource: inputData.resourceId,
          thread: inputData.threadId,
        },
      }
    );

    const duration = Date.now() - startTime;
    console.log(`⏱️  DDL generation took: ${duration}ms`);

    if (!result.text) {
      throw new Error("Agent failed to generate DDL script");
    }

    // Clean up the response - remove markdown code blocks if present
    let ddlScript = result.text.trim();
    if (ddlScript.startsWith("```sql")) {
      ddlScript = ddlScript.replace(/^```sql\n?/, "").replace(/\n?```$/, "");
    } else if (ddlScript.startsWith("```")) {
      ddlScript = ddlScript.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    console.log(`✅ DDL script generated successfully`);
    console.log(`📏 Script length: ${ddlScript.length} characters`);

    return {
      threadId: inputData.threadId,
      resourceId: inputData.resourceId,
      updatedSchema: inputData.updatedSchema,
      ddlScript: ddlScript,
      agentResponse: inputData.agentResponse,
    };
  },
});
export default conversationalDdlGenerationStep;
