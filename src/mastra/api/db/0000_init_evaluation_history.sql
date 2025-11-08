CREATE TABLE "evaluation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"question_description" text NOT NULL,
	"erd_image_url" text NOT NULL,
	"extracted_information" jsonb,
	"score" real,
	"evaluation_report" text,
	"workflow_run_id" varchar(255) NOT NULL,
	"workflow_mode" varchar(50) DEFAULT 'standard',
	"preferred_format" varchar(50) DEFAULT 'mermaid',
	"status" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
