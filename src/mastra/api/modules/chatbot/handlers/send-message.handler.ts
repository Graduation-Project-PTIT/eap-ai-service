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
  buildFullContext,
  convertErdToPhysicalDb,
  executeWorkflow,
  ConversationType,
} from "../services";
import { db } from "../../../db";
import { chatbotConversationHistory } from "../../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Handle blocked schema request - save messages and return response
 */
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

/**
 * Handle ERD → Physical DB conversion request
 */
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

  // Save user message
  await saveUserMessage(conversationId, message, enableSearch);

  // Save assistant message with full metadata
  await saveAssistantMessage(conversationId, conversionResult.agentResponse, {
    schemaSnapshot: conversionResult.physicalSchema,
    ddlSnapshot: conversionResult.ddlScript,
    runId: undefined,
    intent: "schema",
  });

  // Update conversation with physical schema
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

/**
 * Main send message handler
 */
const sendMessageHandler = async (c: Context) => {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    // 1. Parse and validate input
    const input = await c.req.json<SendMessageInput>();
    const user = c.get("user");
    const mastra = c.get("mastra");

    logRequestStart(requestId, input, user.sub);

    const validatedInput = sendMessageInputSchema.parse(input);
    const { conversationId, message, enableSearch } = validatedInput;

    // 2. Find or create conversation
    const conversation = await findOrCreateConversation(
      conversationId,
      user.sub,
      message
    );

    // 3. Verify user ownership
    verifyOwnership(conversation, user.sub);

    // 4. Fetch conversation history
    const messages = await fetchConversationHistory(conversationId);

    // 5. Classify intent with conversation context
    const intent = await classifyIntent(mastra, message, messages);

    // 6. Save domain if confidence is high enough
    if (shouldSaveDomain(conversation, intent)) {
      await updateConversationDomain(
        conversationId,
        intent.domain!,
        intent.domainConfidence!
      );
      // Update local reference
      conversation.domain = intent.domain!;
      conversation.domainConfidence = intent.domainConfidence!.toString();
    } else if (conversation.domain) {
      console.log(
        `📌 Preserving existing conversation domain: "${conversation.domain}" (intent domain: ${intent.domain || "null"})`
      );
    }

    // 7. Validate schema request (may return early with blocked response)
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

    // 8. Handle ERD → Physical DB conversion if requested
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

    // 9. Build context for LLM
    const fullContext = buildFullContext(
      conversation,
      messages,
      intent,
      message
    );

    // 10. Save user message
    await saveUserMessage(conversationId, message, enableSearch ?? false);

    // 11. Execute workflow
    const workflowResult = await executeWorkflow(mastra, {
      userMessage: message,
      fullContext,
      domain: conversation.domain || null,
      schemaContext: conversation.currentDdl || null,
      conversationHistory: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      intent: intent.intent,
      schemaIntent: intent.schemaIntent,
      diagramType: intent.diagramType,
      confidence: intent.confidence,
      enableSearch: enableSearch ?? false,
    });

    // 12. Handle workflow failure
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

    // 13. Prepare response data
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

    // 14. Add conversion tip for initial ERD creation
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

    // 15. Save assistant message
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

    // 16. Update conversation with appropriate schema
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

    // 17. Log completion and return response
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

    // Handle unauthorized error specifically
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
