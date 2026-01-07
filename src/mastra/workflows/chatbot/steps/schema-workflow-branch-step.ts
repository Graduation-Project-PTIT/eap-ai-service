import { createStep } from "@mastra/core";
import z from "zod";
import dbInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import { buildSchemaGenerationContext } from "../../../utils/context-utils";

/**
 * Schema Workflow Branch Step
 *
 * This step invokes the existing dbGenerationWorkflow
 * when the intent is classified as "schema" with diagramType "PHYSICAL_DB".
 * It builds the appropriate context based on create/modify intent.
 */
const schemaWorkflowBranchStep = createStep({
  id: "schemaWorkflowBranchStep",

  inputSchema: z.object({
    userMessage: z.string().describe("The user's current message"),
    domain: z.string().nullable(),
    currentErdSchema: z.any().nullable(),
    currentPhysicalSchema: z.any().nullable(),
    currentDdl: z.string().nullable(),
    conversationHistory: z
      .array(
        z.object({
          role: z.string(),
          content: z.string(),
          createdAt: z.string().optional(),
        })
      )
      .optional(),
    intent: z.enum(["schema", "side-question"]),
    schemaIntent: z.enum(["create", "modify"]).nullable(),
    diagramType: z.enum(["ERD", "PHYSICAL_DB"]).nullable(),
    confidence: z.number(),
    enableSearch: z.boolean().optional().default(true),
  }),

  outputSchema: z.object({
    response: z.string().optional(),
    updatedSchema: dbInformationGenerationSchema.optional(),
    updatedErdSchema: erdInformationGenerationSchema.optional(),
    ddlScript: z.string().optional(),
    agentResponse: z.string().optional(),
    isSideQuestion: z.boolean(),
    isSchemaGeneration: z.boolean(),
    isErdGeneration: z.boolean(),
  }),

  execute: async ({ inputData, mastra }) => {
    const {
      userMessage,
      domain,
      currentPhysicalSchema,
      currentDdl,
      conversationHistory,
      schemaIntent,
      enableSearch,
    } = inputData;

    // Build context optimized for Physical DB generation
    const fullContext = buildSchemaGenerationContext({
      userMessage,
      schemaIntent,
      diagramType: "PHYSICAL_DB",
      erdSchema: null, // Physical DB uses DDL, not ERD
      ddl: currentDdl,
      conversationHistory: conversationHistory || [],
    });

    console.log(`🏗️ Running Physical DB schema generation workflow...`);
    console.log(`📏 User message: ${userMessage.length} chars`);
    console.log(`📏 Built context: ${fullContext.length} chars`);
    console.log(`🏷️  Domain: ${domain || "none"}`);
    console.log(`🔧 Schema intent: ${schemaIntent || "create"}`);

    const workflow = mastra.getWorkflow("dbGenerationWorkflow");

    if (!workflow) {
      throw new Error("DB generation workflow not found");
    }

    const run = await workflow.createRunAsync();

    const result = await run.start({
      inputData: {
        userMessage,
        fullContext,
        domain,
        enableSearch,
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

    console.log(`✅ Physical DB schema workflow completed`);

    return {
      response: workflowResult.agentResponse,
      updatedSchema: workflowResult.updatedSchema,
      updatedErdSchema: undefined,
      ddlScript: workflowResult.ddlScript,
      agentResponse: workflowResult.agentResponse,
      isSideQuestion: false,
      isSchemaGeneration: true,
      isErdGeneration: false,
    };
  },
});

export default schemaWorkflowBranchStep;
