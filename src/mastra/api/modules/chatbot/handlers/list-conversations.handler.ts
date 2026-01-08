import { Context } from "hono";
import { db } from "../../../db";
import { chatbotConversationHistory } from "../../../db/schema";
import { eq, desc } from "drizzle-orm";

const listConversationsHandler = async (c: Context) => {
  try {
    const user = c.get("user");

    console.log(`📋 Fetching conversations for user: ${user.sub}`);

    const conversations = await db
      .select({
        id: chatbotConversationHistory.id,
        conversationTitle: chatbotConversationHistory.conversationTitle,
        status: chatbotConversationHistory.status,
        createdAt: chatbotConversationHistory.createdAt,
        lastMessageAt: chatbotConversationHistory.lastMessageAt,
        updatedAt: chatbotConversationHistory.updatedAt,
      })
      .from(chatbotConversationHistory)
      .where(eq(chatbotConversationHistory.userId, user.sub))
      .orderBy(desc(chatbotConversationHistory.lastMessageAt));

    console.log(`✅ Found ${conversations.length} conversations`);

    return c.json({
      success: true,
      conversations,
      total: conversations.length,
    });
  } catch (error: any) {
    console.error("❌ Error in listConversationsHandler:", error);
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

export default listConversationsHandler;
