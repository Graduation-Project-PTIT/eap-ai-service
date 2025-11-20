ALTER TABLE "chatbot_conversation_history" ADD COLUMN "domain" varchar(255);--> statement-breakpoint
ALTER TABLE "chatbot_conversation_history" ADD COLUMN "domain_confidence" numeric(3, 2);