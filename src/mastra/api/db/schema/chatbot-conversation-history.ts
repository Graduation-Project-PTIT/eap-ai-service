import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";

export const chatbotConversationHistory = pgTable(
  "chatbot_conversation_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    conversationTitle: text("conversation_title"),
    domain: varchar("domain", { length: 255 }), // e.g., "hotel booking", "e-commerce"
    domainConfidence: numeric("domain_confidence", { precision: 3, scale: 2 }), // 0.00-1.00
    currentSchema: jsonb("current_schema"),
    currentDdl: text("current_ddl"),
    lastRunId: varchar("last_run_id", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull().default("active"), // active, completed, archived
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastMessageAt: timestamp("last_message_at").defaultNow(),
  }
);
