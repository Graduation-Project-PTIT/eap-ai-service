import { Context } from "hono";
import {
  SendMessageInput,
  sendMessageInputSchema,
} from "../types/send-message.input";
import {
  generateRequestId,
  logRequestStart,
  logRequestComplete,
  logRequestError,
} from "../utils";
import {
  classifyIntent,
  findOrCreateConversation,
  verifyOwnership,
  fetchConversationHistory,
  updateConversationDomain,
  updateConversationTimestamp,
  updateConversationWithErdSchema,
  updateConversationWithPhysicalSchema,
  saveUserMessage,
  saveAssistantMessage,
  saveBlockedMessages,
  validateSchemaRequest,
  shouldSaveDomain,
  isConversionRequest,
  convertErdToPhysicalDb,
  executeWorkflow,
  ConversationType,
} from "../services";
import { db } from "../../../db";
import { chatbotConversationHistory } from "../../../db/schema";
import { eq } from "drizzle-orm";

async function handleBlockedResponse(
  c: Context,
  conversationId: string,
  message: string,
  enableSearch: boolean,
  blockedMessage: string,
  blockedResponse: { schema: any; erdSchema: any; ddl: string }
): Promise<Response> {
  await saveBlockedMessages(
    conversationId,
    message,
    blockedMessage,
    enableSearch
  );

  await db
    .update(chatbotConversationHistory)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatbotConversationHistory.id, conversationId));

  return c.json({
    success: true,
    conversationId,
    response: blockedMessage,
    schema: blockedResponse.schema,
    erdSchema: blockedResponse.erdSchema,
    ddl: blockedResponse.ddl,
    blocked: true,
  });
}

async function handleErdConversion(
  c: Context,
  mastra: any,
  conversationId: string,
  conversation: ConversationType,
  message: string,
  enableSearch: boolean
): Promise<Response> {
  const conversionResult = await convertErdToPhysicalDb(
    mastra,
    conversation.currentErdSchema
  );

  await saveUserMessage(conversationId, message, enableSearch);

  await saveAssistantMessage(conversationId, conversionResult.agentResponse, {
    schemaSnapshot: conversionResult.physicalSchema,
    ddlSnapshot: conversionResult.ddlScript,
    runId: undefined,
    intent: "schema",
  });

  await db
    .update(chatbotConversationHistory)
    .set({
      currentSchema: conversionResult.physicalSchema,
      currentDdl: conversionResult.ddlScript,
      diagramType: "PHYSICAL_DB",
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(chatbotConversationHistory.id, conversationId));

  return c.json({
    success: true,
    conversationId,
    response: conversionResult.agentResponse,
    schema: conversionResult.physicalSchema,
    erdSchema: conversation.currentErdSchema,
    ddl: conversionResult.ddlScript,
    diagramType: "PHYSICAL_DB",
  });
}

const sendMessageHandler = async (c: Context) => {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    const input = await c.req.json<SendMessageInput>();
    const user = c.get("user");
    const mastra = c.get("mastra");

    logRequestStart(requestId, input, user.sub);

    const validatedInput = sendMessageInputSchema.parse(input);
    const { conversationId, message, enableSearch } = validatedInput;

    const conversation = await findOrCreateConversation(
      conversationId,
      user.sub,
      message
    );

    verifyOwnership(conversation, user.sub);

    const messages = await fetchConversationHistory(conversationId);

    const intent = await classifyIntent(mastra, message, messages);

    if (shouldSaveDomain(conversation, intent)) {
      await updateConversationDomain(
        conversationId,
        intent.domain!,
        intent.domainConfidence!
      );
      conversation.domain = intent.domain!;
      conversation.domainConfidence = intent.domainConfidence!.toString();
    } else if (conversation.domain) {
      console.log(
        `📌 Preserving existing conversation domain: "${conversation.domain}" (intent domain: ${intent.domain || "null"})`
      );
    }

    const validation = validateSchemaRequest(conversation, intent);
    if (!validation.valid) {
      return handleBlockedResponse(
        c,
        conversationId,
        message,
        enableSearch ?? false,
        validation.blockedMessage!,
        validation.blockedResponse!
      );
    }

    if (isConversionRequest(conversation, intent)) {
      return handleErdConversion(
        c,
        mastra,
        conversationId,
        conversation,
        message,
        enableSearch ?? false
      );
    }

    await saveUserMessage(conversationId, message, enableSearch ?? false);

    const workflowResult = await executeWorkflow(mastra, {
      userMessage: message,
      domain: conversation.domain || null,
      currentErdSchema: conversation.currentErdSchema || null,
      currentPhysicalSchema: conversation.currentSchema || null,
      currentDdl: conversation.currentDdl || null,
      conversationHistory: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt?.toISOString(),
      })),
      intent: intent.intent,
      schemaIntent: intent.schemaIntent,
      diagramType: intent.diagramType,
      confidence: intent.confidence,
      enableSearch: enableSearch ?? false,
    });

    if (!workflowResult.success) {
      return c.json(
        {
          success: false,
          conversationId,
          response: workflowResult.responseText,
          schema: conversation.currentSchema || { entities: [] },
          erdSchema: conversation.currentErdSchema || null,
          ddl: conversation.currentDdl || "",
          runId: workflowResult.runId,
        },
        500
      );
    }

    let schema = conversation.currentSchema || { entities: [] };
    let erdSchema = conversation.currentErdSchema || null;
    let ddl = conversation.currentDdl || "";
    let diagramType = conversation.diagramType || null;

    if (workflowResult.isErdGeneration && workflowResult.updatedErdSchema) {
      erdSchema = workflowResult.updatedErdSchema;
      diagramType = "ERD";
    } else if (
      workflowResult.isPhysicalGeneration &&
      workflowResult.updatedSchema
    ) {
      schema = workflowResult.updatedSchema;
      ddl = workflowResult.ddlScript || "";
      diagramType = "PHYSICAL_DB";
    }

    let finalResponseText = workflowResult.responseText;
    const hasCurrentErdSchema =
      conversation.currentErdSchema &&
      Object.keys(conversation.currentErdSchema as object).length > 0;
    const isInitialErdCreation =
      workflowResult.isErdGeneration && !hasCurrentErdSchema;

    if (isInitialErdCreation) {
      finalResponseText +=
        '\n\n---\n\n💡 **Tip:** Would you like me to convert this ERD to a Physical Database schema with DDL? Just ask "Convert to Physical DB" or "Generate database tables".';
    }

    await saveAssistantMessage(conversationId, finalResponseText, {
      schemaSnapshot: workflowResult.isPhysicalGeneration
        ? workflowResult.updatedSchema
        : workflowResult.isErdGeneration
          ? workflowResult.updatedErdSchema
          : null,
      ddlSnapshot: workflowResult.isPhysicalGeneration
        ? workflowResult.ddlScript
        : null,
      runId: workflowResult.runId,
      intent: workflowResult.isSideQuestion ? "side-question" : "schema",
    });

    if (workflowResult.isErdGeneration) {
      await updateConversationWithErdSchema(
        conversationId,
        workflowResult.updatedErdSchema,
        workflowResult.runId
      );
    } else if (workflowResult.isPhysicalGeneration) {
      await updateConversationWithPhysicalSchema(
        conversationId,
        workflowResult.updatedSchema,
        workflowResult.ddlScript || "",
        workflowResult.runId
      );
    } else {
      await updateConversationTimestamp(conversationId, workflowResult.runId);
    }

    const result = {
      success: true,
      conversationId,
      response: finalResponseText,
      schema,
      erdSchema,
      ddl,
      diagramType,
      runId: workflowResult.runId,
    };

    logRequestComplete(requestId, startTime, result);

    return c.json(result);
  } catch (error: any) {
    logRequestError(requestId, startTime, error);

    if (error.message === "Unauthorized") {
      return c.json({ error: "Unauthorized" }, 403);
    }

    return c.json(
      {
        success: false,
        error: "Internal server error",
        message: error.message || "Unknown error",
      },
      500
    );
  }
};

export default sendMessageHandler;
