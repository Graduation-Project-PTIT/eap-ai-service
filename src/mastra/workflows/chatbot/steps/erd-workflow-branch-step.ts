import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import dbInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";

/**
 * ERD Workflow Branch Step
 *
 * This step invokes the erdGenerationWorkflow
 * when the intent is classified as "schema" with diagramType "ERD".
 */
const erdWorkflowBranchStep = createStep({
  id: "erdWorkflowBranchStep",

  inputSchema: z.object({
    userMessage: z.string().describe("The user's current message"),
    fullContext: z.string().describe("Full context including schema + history"),
    domain: z.string().nullable(),
    schemaContext: z.string().nullable(),
    conversationHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
      .optional(),
    intent: z.enum(["schema", "side-question"]),
    schemaIntent: z.enum(["create", "modify"]).nullable(),
    diagramType: z.enum(["ERD", "PHYSICAL_DB"]).nullable(),
    confidence: z.number(),
    enableSearch: z.boolean().optional().default(true),
  }),

  outputSchema: z.object({
    response: z.string().optional(),
    updatedSchema: dbInformationGenerationSchema.optional(), // Physical DB schema (not used for ERD)
    updatedErdSchema: erdInformationGenerationSchema.optional(), // ERD schema
    ddlScript: z.string().optional(),
    agentResponse: z.string().optional(),
    isSideQuestion: z.boolean(),
    isSchemaGeneration: z.boolean(),
    isErdGeneration: z.boolean(),
  }),

  execute: async ({ inputData, mastra }) => {
    console.log(`🏗️ Running ERD generation workflow...`);
    console.log(`📏 User message: ${inputData.userMessage.length} chars`);
    console.log(`📏 Full context: ${inputData.fullContext.length} chars`);
    console.log(`🏷️  Domain: ${inputData.domain || "none"}`);

    // Get and execute the erdGenerationWorkflow
    const workflow = mastra.getWorkflow("erdGenerationWorkflow");

    if (!workflow) {
      throw new Error("ERD generation workflow not found");
    }

    // Create a new workflow run
    const run = await workflow.createRunAsync();

    // Start the workflow with structured input
    const result = await run.start({
      inputData: {
        userMessage: inputData.userMessage,
        fullContext: inputData.fullContext,
        domain: inputData.domain,
        enableSearch: inputData.enableSearch,
      },
    });

    if (result.status !== "success") {
      throw new Error(`ERD workflow failed: ${result.status}`);
    }

    const workflowResult = result.result as {
      updatedErdSchema: any;
      agentResponse: string;
    };

    console.log(`✅ ERD workflow completed`);
    console.log(`   - Entities: ${workflowResult.updatedErdSchema?.entities?.length || 0}`);
    console.log(`   - Relationships: ${workflowResult.updatedErdSchema?.relationships?.length || 0}`);

    return {
      response: workflowResult.agentResponse,
      updatedSchema: undefined, // No Physical DB schema for ERD
      updatedErdSchema: workflowResult.updatedErdSchema,
      ddlScript: undefined, // No DDL for ERD
      agentResponse: workflowResult.agentResponse,
      isSideQuestion: false,
      isSchemaGeneration: false,
      isErdGeneration: true,
    };
  },
});

export default erdWorkflowBranchStep;

