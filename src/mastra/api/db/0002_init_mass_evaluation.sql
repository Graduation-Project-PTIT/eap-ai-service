CREATE TABLE "mass_evaluation_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_description" text NOT NULL,
	"status" varchar(50) NOT NULL,
	"average_score" real,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "evaluation_history" ALTER COLUMN "workflow_run_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_history" ADD COLUMN "file_key" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_history" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "evaluation_history" DROP COLUMN "erd_image_url";