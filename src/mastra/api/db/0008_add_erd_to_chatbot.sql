ALTER TABLE "chatbot_conversation_history" ADD COLUMN "current_erd_schema" jsonb;--> statement-breakpoint
ALTER TABLE "chatbot_conversation_history" ADD COLUMN "diagram_type" varchar(20);