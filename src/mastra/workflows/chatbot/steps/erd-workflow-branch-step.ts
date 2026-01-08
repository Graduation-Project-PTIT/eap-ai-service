import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import dbInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";
import { buildSchemaGenerationContext } from "../../../utils/context-utils";

const erdWorkflowBranchStep = createStep({
  id: "erdWorkflowBranchStep",

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
      currentErdSchema,
      currentDdl,
      conversationHistory,
      schemaIntent,
      enableSearch,
    } = inputData;

    const fullContext = buildSchemaGenerationContext({
      userMessage,
      schemaIntent,
      diagramType: "ERD",
      erdSchema: currentErdSchema,
      ddl: currentDdl,
      conversationHistory: conversationHistory || [],
    });

    console.log(`🏗️ Running ERD generation workflow...`);
    console.log(`📏 User message: ${userMessage.length} chars`);
    console.log(`📏 Built context: ${fullContext.length} chars`);
    console.log(`🏷️  Domain: ${domain || "none"}`);
    console.log(`🔧 Schema intent: ${schemaIntent || "create"}`);

    const workflow = mastra.getWorkflow("erdGenerationWorkflow");

    if (!workflow) {
      throw new Error("ERD generation workflow not found");
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
      throw new Error(`ERD workflow failed: ${result.status}`);
    }

    const workflowResult = result.result as {
      updatedErdSchema: any;
      agentResponse: string;
    };

    console.log(`✅ ERD workflow completed`);
    console.log(
      `   - Entities: ${workflowResult.updatedErdSchema?.entities?.length || 0}`
    );
    console.log(
      `   - Relationships: ${workflowResult.updatedErdSchema?.relationships?.length || 0}`
    );

    return {
      response: workflowResult.agentResponse,
      updatedSchema: undefined,
      updatedErdSchema: workflowResult.updatedErdSchema,
      ddlScript: undefined,
      agentResponse: workflowResult.agentResponse,
      isSideQuestion: false,
      isSchemaGeneration: false,
      isErdGeneration: true,
    };
  },
});

export default erdWorkflowBranchStep;
