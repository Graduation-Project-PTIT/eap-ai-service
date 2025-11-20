import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { chatbotConversationHistory } from "./chatbot-conversation-history";

export const chatbotMessageHistory = pgTable("chatbot_message_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => chatbotConversationHistory.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant
  content: text("content").notNull(),
  schemaSnapshot: jsonb("schema_snapshot"),
  ddlSnapshot: text("ddl_snapshot"),
  runId: varchar("run_id", { length: 255 }),
  intent: varchar("intent", { length: 50 }), // schema | side-question
  confidence: real("confidence"),
  enableSearch: boolean("enable_search").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations - Define both directions here to avoid circular imports
export const chatbotMessageHistoryRelations = relations(
  chatbotMessageHistory,
  ({ one }) => ({
    conversation: one(chatbotConversationHistory, {
      fields: [chatbotMessageHistory.conversationId],
      references: [chatbotConversationHistory.id],
    }),
  })
);

export const chatbotConversationHistoryRelations = relations(
  chatbotConversationHistory,
  ({ many }) => ({
    messages: many(chatbotMessageHistory),
  })
);
