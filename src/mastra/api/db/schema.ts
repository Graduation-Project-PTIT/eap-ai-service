import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  real,
} from "drizzle-orm/pg-core";

export const evaluationHistory = pgTable("evaluation_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  questionDescription: text("question_description").notNull(),
  erdImageUrl: text("erd_image_url").notNull(),
  extractedInformation: jsonb("extracted_information"),
  score: real("score"),
  evaluationReport: text("evaluation_report"),
  workflowRunId: varchar("workflow_run_id", { length: 255 }).notNull(),
  workflowMode: varchar("workflow_mode", { length: 50 }).default("standard"), // standard or sync
  preferredFormat: varchar("preferred_format", { length: 50 }).default(
    "mermaid"
  ), // json, ddl, or mermaid
  status: varchar("status", { length: 50 }).notNull(), // pending, running, completed, failed, waiting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
