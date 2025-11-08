CREATE TABLE "evaluation_translation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"target_language" varchar(50) NOT NULL,
	"translated_report" text,
	"workflow_run_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
