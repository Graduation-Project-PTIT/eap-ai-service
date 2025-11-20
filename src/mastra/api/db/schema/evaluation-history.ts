import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { massEvaluationBatch } from "./mass-evaluation-batch";
import { relations } from "drizzle-orm";

export const evaluationHistory = pgTable("evaluation_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  questionDescription: text("question_description").notNull(),
  fileKey: varchar("file_key", { length: 255 }).notNull(),
  extractedInformation: jsonb("extracted_information"),
  score: real("score"),
  evaluationReport: text("evaluation_report"),
  workflowRunId: varchar("workflow_run_id", { length: 255 }),
  workflowMode: varchar("workflow_mode", { length: 50 }).default("standard"), // standard or sync
  preferredFormat: varchar("preferred_format", { length: 50 }).default(
    "mermaid"
  ), // json, ddl, or mermaid
  status: varchar("status", { length: 50 }).notNull(), // pending, running, completed, failed, waiting
  batchId: uuid("batch_id"),
  studentCode: varchar("student_code", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const evaluationHistoryRelations = relations(
  evaluationHistory,
  ({ one }) => ({
    batch: one(massEvaluationBatch, {
      fields: [evaluationHistory.batchId],
      references: [massEvaluationBatch.id],
    }),
  })
);
