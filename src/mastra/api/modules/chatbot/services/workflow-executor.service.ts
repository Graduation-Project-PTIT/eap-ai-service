import { IntentClassification } from "./intent-classification.service";

export interface WorkflowInput {
  userMessage: string;
  domain: string | null;
  currentErdSchema: any | null;
  currentPhysicalSchema: any | null;
  currentDdl: string | null;
  conversationHistory: { role: string; content: string; createdAt?: string }[];
  intent: IntentClassification["intent"];
  schemaIntent: IntentClassification["schemaIntent"];
  diagramType: IntentClassification["diagramType"];
  confidence: number;
  enableSearch: boolean;
}

export interface WorkflowResult {
  success: boolean;
  responseText: string;
  updatedSchema?: any;
  updatedErdSchema?: any;
  ddlScript?: string;
  isErdGeneration: boolean;
  isPhysicalGeneration: boolean;
  isSideQuestion: boolean;
  runId: string;
}

export async function executeWorkflow(
  mastra: any,
  input: WorkflowInput
): Promise<WorkflowResult> {
  const workflow = mastra.getWorkflow("chatbotWorkflow");
  if (!workflow) {
    console.error(`❌ Chatbot workflow not found`);
    throw new Error("Chatbot workflow not found");
  }

  const run = await workflow.createRunAsync();
  console.log(`🚀 Starting workflow run: ${run.runId}`);

  const workflowResult = await run.start({
    inputData: {
      userMessage: input.userMessage,
      domain: input.domain,
      currentErdSchema: input.currentErdSchema,
      currentPhysicalSchema: input.currentPhysicalSchema,
      currentDdl: input.currentDdl,
      conversationHistory: input.conversationHistory,
      intent: input.intent,
      schemaIntent: input.schemaIntent,
      diagramType: input.diagramType,
      confidence: input.confidence,
      enableSearch: input.enableSearch,
    },
  });

  console.log(`🏁 Workflow completed with status: ${workflowResult.status}`);

  const success = workflowResult.status === "success";

  if (!success) {
    console.error(`❌ Workflow failed:`, workflowResult);
    return {
      success: false,
      responseText: "An error occurred processing your message",
      isErdGeneration: false,
      isPhysicalGeneration: false,
      isSideQuestion: false,
      runId: run.runId,
    };
  }

  const rawResult = workflowResult.result as any;
  console.log(`🔍 Raw workflow result keys:`, Object.keys(rawResult));

  const result = (rawResult.erdWorkflowBranchStep ||
    rawResult.schemaWorkflowBranchStep ||
    rawResult.sideQuestionStep ||
    rawResult) as {
    response?: string;
    updatedSchema?: any;
    updatedErdSchema?: any;
    ddlScript?: string;
    agentResponse?: string;
    isSideQuestion: boolean;
    isSchemaGeneration: boolean;
    isErdGeneration?: boolean;
  };

  const isErdGeneration = result.isErdGeneration === true;
  const isPhysicalGeneration = result.isSchemaGeneration === true;

  console.log(
    `📤 Preparing response - isErd: ${isErdGeneration}, isPhysical: ${isPhysicalGeneration}, isSideQuestion: ${result.isSideQuestion}`
  );

  return {
    success: true,
    responseText: result.response || result.agentResponse || "",
    updatedSchema: result.updatedSchema,
    updatedErdSchema: result.updatedErdSchema,
    ddlScript: result.ddlScript,
    isErdGeneration,
    isPhysicalGeneration,
    isSideQuestion: result.isSideQuestion,
    runId: run.runId,
  };
}
