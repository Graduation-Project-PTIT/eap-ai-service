ALTER TABLE "chatbot_conversation_history" DROP CONSTRAINT "chatbot_conversation_history_thread_id_unique";--> statement-breakpoint
ALTER TABLE "chatbot_conversation_history" DROP COLUMN "thread_id";--> statement-breakpoint
ALTER TABLE "chatbot_conversation_history" DROP COLUMN "resource_id";