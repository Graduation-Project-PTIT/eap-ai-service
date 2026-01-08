import { db } from "../../../db";
import {
  chatbotConversationHistory,
  chatbotMessageHistory,
} from "../../../db/schema";
import { eq, asc } from "drizzle-orm";

export type ConversationType = typeof chatbotConversationHistory.$inferSelect;

export interface MessageType {
  role: string;
  content: string;
  createdAt: Date | null;
}

export async function findOrCreateConversation(
  conversationId: string,
  userId: string,
  messagePreview: string
): Promise<ConversationType> {
  let conversation = await db
    .select()
    .from(chatbotConversationHistory)
    .where(eq(chatbotConversationHistory.id, conversationId))
    .limit(1);

  if (!conversation[0]) {
    console.log(`📝 Creating new conversation: ${conversationId}`);
    const conversationTitle =
      messagePreview.length > 50
        ? messagePreview.substring(0, 50) + "..."
        : messagePreview;

    conversation = await db
      .insert(chatbotConversationHistory)
      .values({
        id: conversationId,
        userId,
        conversationTitle,
        status: "active",
      })
      .returning();
    console.log(`✅ Conversation created successfully`);
  } else {
    console.log(`📖 Using existing conversation: ${conversationId}`);
  }

  return conversation[0];
}

export function verifyOwnership(
  conversation: ConversationType,
  userId: string
): void {
  if (conversation.userId !== userId) {
    console.error(
      `❌ Unauthorized access attempt for conversation: ${conversation.id}`
    );
    throw new Error("Unauthorized");
  }
}

export async function fetchConversationHistory(
  conversationId: string,
  limit: number = 20
): Promise<MessageType[]> {
  const messages = await db
    .select({
      role: chatbotMessageHistory.role,
      content: chatbotMessageHistory.content,
      createdAt: chatbotMessageHistory.createdAt,
    })
    .from(chatbotMessageHistory)
    .where(eq(chatbotMessageHistory.conversationId, conversationId))
    .orderBy(asc(chatbotMessageHistory.createdAt))
    .limit(limit);

  console.log(`📚 Fetched ${messages.length} previous messages for context`);
  return messages;
}

export async function updateConversationDomain(
  conversationId: string,
  domain: string,
  confidence: number
): Promise<void> {
  console.log(`💾 Saving domain: "${domain}" (confidence: ${confidence})`);
  await db
    .update(chatbotConversationHistory)
    .set({
      domain,
      domainConfidence: confidence.toString(),
      updatedAt: new Date(),
    })
    .where(eq(chatbotConversationHistory.id, conversationId));
}

export async function updateConversationTimestamp(
  conversationId: string,
  runId?: string
): Promise<void> {
  const updateData: Record<string, any> = {
    lastMessageAt: new Date(),
    updatedAt: new Date(),
  };
  if (runId) {
    updateData.lastRunId = runId;
  }
  await db
    .update(chatbotConversationHistory)
    .set(updateData)
    .where(eq(chatbotConversationHistory.id, conversationId));
}

export async function updateConversationWithErdSchema(
  conversationId: string,
  erdSchema: any,
  runId: string
): Promise<void> {
  await db
    .update(chatbotConversationHistory)
    .set({
      currentErdSchema: erdSchema,
      diagramType: "ERD",
      lastRunId: runId,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(chatbotConversationHistory.id, conversationId));
  console.log(`✅ Conversation updated with new ERD schema`);
}

export async function updateConversationWithPhysicalSchema(
  conversationId: string,
  schema: any,
  ddl: string,
  runId: string
): Promise<void> {
  await db
    .update(chatbotConversationHistory)
    .set({
      currentSchema: schema,
      currentDdl: ddl,
      diagramType: "PHYSICAL_DB",
      lastRunId: runId,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(chatbotConversationHistory.id, conversationId));
  console.log(`✅ Conversation updated with new Physical DB schema`);
}

export async function saveUserMessage(
  conversationId: string,
  message: string,
  enableSearch: boolean
): Promise<void> {
  await db.insert(chatbotMessageHistory).values({
    conversationId,
    role: "user",
    content: message,
    enableSearch,
  });
  console.log(`💾 User message saved to database`);
}

export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  options: {
    schemaSnapshot?: any;
    ddlSnapshot?: string | null;
    runId?: string;
    intent: "schema" | "side-question";
  }
): Promise<void> {
  await db.insert(chatbotMessageHistory).values({
    conversationId,
    role: "assistant",
    content,
    schemaSnapshot: options.schemaSnapshot ?? null,
    ddlSnapshot: options.ddlSnapshot ?? null,
    runId: options.runId,
    intent: options.intent,
  });
  console.log(`💾 Assistant message saved to database`);
}

export async function saveBlockedMessages(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  enableSearch: boolean,
  userIntent: string = "schema"
): Promise<void> {
  await db.insert(chatbotMessageHistory).values([
    {
      conversationId,
      role: "user",
      content: userMessage,
      enableSearch,
      intent: userIntent,
    },
    {
      conversationId,
      role: "assistant",
      content: assistantMessage,
      intent: "side-question",
    },
  ]);
}
