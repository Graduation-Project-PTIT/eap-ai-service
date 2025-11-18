import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";

/**
 * Schema Workflow Branch Step
 *
 * This step invokes the existing dbGenerationWorkflow
 * when the intent is classified as "schema".
 */
const schemaWorkflowBranchStep = createStep({
  id: "schemaWorkflowBranchStep",

  inputSchema: z.object({
    userMessage: z.string(),
    intent: z.enum(["schema", "side-question"]),
    schemaIntent: z.enum(["create", "modify"]).nullable(),
    confidence: z.number(),
    enableSearch: z.boolean().optional().default(true),
  }),

  outputSchema: z.object({
    response: z.string().optional(),
    updatedSchema: erdInformationGenerationSchema.optional(),
    ddlScript: z.string().optional(),
    agentResponse: z.string().optional(),
    isSideQuestion: z.boolean(),
    isSchemaGeneration: z.boolean(),
  }),

  execute: async ({ inputData, mastra }) => {
    console.log(`🏗️ Running schema generation workflow...`);

    // Get and execute the dbGenerationWorkflow
    const workflow = mastra.getWorkflow("dbGenerationWorkflow");

    if (!workflow) {
      throw new Error("DB generation workflow not found");
    }

    // Create a new workflow run
    const run = await workflow.createRunAsync();

    // Start the workflow
    const result = await run.start({
      inputData: {
        userMessage: inputData.userMessage,
        enableSearch: inputData.enableSearch,
      },
    });

    if (result.status !== "success") {
      throw new Error(`Schema workflow failed: ${result.status}`);
    }

    const workflowResult = result.result as {
      updatedSchema: any;
      ddlScript: string;
      agentResponse: string;
    };

    console.log(`✅ Schema workflow completed`);

    return {
      response: workflowResult.agentResponse,
      updatedSchema: workflowResult.updatedSchema,
      ddlScript: workflowResult.ddlScript,
      agentResponse: workflowResult.agentResponse,
      isSideQuestion: false,
      isSchemaGeneration: true,
    };
  },
});

export default schemaWorkflowBranchStep;
