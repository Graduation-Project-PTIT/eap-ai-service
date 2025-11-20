CREATE TABLE "chatbot_conversation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"thread_id" varchar(255) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"conversation_title" text,
	"current_schema" jsonb,
	"current_ddl" text,
	"last_run_id" varchar(255),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_message_at" timestamp DEFAULT now(),
	CONSTRAINT "chatbot_conversation_history_thread_id_unique" UNIQUE("thread_id")
);
--> statement-breakpoint
CREATE TABLE "chatbot_message_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"schema_snapshot" jsonb,
	"ddl_snapshot" text,
	"run_id" varchar(255),
	"intent" varchar(50),
	"confidence" real,
	"enable_search" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chatbot_message_history" ADD CONSTRAINT "chatbot_message_history_conversation_id_chatbot_conversation_history_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chatbot_conversation_history"("id") ON DELETE cascade ON UPDATE no action;