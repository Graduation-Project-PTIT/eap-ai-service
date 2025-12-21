import type { Context } from "hono";
import { db } from "../../../db";
import {
  chatbotConversationHistory,
  chatbotMessageHistory,
} from "../../../db/schema";
import { eq, asc } from "drizzle-orm";

const getConversationHandler = async (c: Context) => {
  const { conversationId } = c.req.param();
  const user = c.get("user");

  // 1. Get conversation
  const conversation = await db
    .select()
    .from(chatbotConversationHistory)
    .where(eq(chatbotConversationHistory.id, conversationId))
    .limit(1);

  // 2. Check if conversation exists
  if (!conversation[0]) {
    return c.json({
      success: true,
      conversationId,
      exists: false,
      schema: null,
      thread: {
        title: "",
        createdAt: "",
        updatedAt: "",
      },
    });
  }

  // 3. Verify user ownership
  if (conversation[0].userId !== user.sub) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // 4. Get all messages for this conversation
  const messages = await db
    .select()
    .from(chatbotMessageHistory)
    .where(eq(chatbotMessageHistory.conversationId, conversationId))
    .orderBy(asc(chatbotMessageHistory.createdAt));

  // 5. Format messages for response
  const formattedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    timestamp: msg.createdAt?.toISOString() || "",
    intent: msg.intent,
    schema: msg.schemaSnapshot as any,
    ddl: msg.ddlSnapshot,
    runId: msg.runId,
  }));

  // 6. Return conversation with messages
  return c.json({
    success: true,
    conversationId: conversation[0].id,
    exists: true,
    schema: conversation[0].currentSchema,
    currentDdl: conversation[0].currentDdl, // Include current DDL from conversation
    erdSchema: conversation[0].currentErdSchema,
    thread: {
      title: conversation[0].conversationTitle || "",
      createdAt: conversation[0].createdAt?.toISOString() || "",
      updatedAt: conversation[0].updatedAt?.toISOString() || "",
    },
    messages: formattedMessages,
  });
};

export default getConversationHandler;
