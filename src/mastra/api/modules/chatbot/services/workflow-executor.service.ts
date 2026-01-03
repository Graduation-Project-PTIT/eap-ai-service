/**
 * Workflow Executor Service
 * Handles execution of chatbot workflow and result parsing
 */

import { MessageType } from "./conversation.service";
import { IntentClassification } from "./intent-classification.service";

/**
 * Input for workflow execution
 */
export interface WorkflowInput {
  userMessage: string;
  fullContext: string;
  domain: string | null;
  schemaContext: string | null;
  conversationHistory: { role: string; content: string }[];
  intent: IntentClassification["intent"];
  schemaIntent: IntentClassification["schemaIntent"];
  diagramType: IntentClassification["diagramType"];
  confidence: number;
  enableSearch: boolean;
}

/**
 * Result from workflow execution
 */
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

/**
 * Execute the chatbot workflow
 */
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
      fullContext: input.fullContext,
      domain: input.domain,
      schemaContext: input.schemaContext,
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

  // Extract the actual result from the branch step wrapper
  const rawResult = workflowResult.result as any;
  console.log(`🔍 Raw workflow result keys:`, Object.keys(rawResult));

  // The branch result is nested under the step ID
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
