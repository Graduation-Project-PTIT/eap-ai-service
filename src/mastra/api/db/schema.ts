import { relations } from "drizzle-orm";
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

export const evaluationTranslationHistory = pgTable(
  "evaluation_translation_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id").notNull(),
    targetLanguage: varchar("target_language", { length: 50 }).notNull(),
    translatedReport: text("translated_report"),
    workflowRunId: varchar("workflow_run_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(), // pending, running, completed, failed, waiting
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  }
);

// Relations
export const translationRelations = relations(
  evaluationTranslationHistory,
  ({ one }) => ({
    evaluationHistory: one(evaluationHistory, {
      fields: [evaluationTranslationHistory.evaluationId],
      references: [evaluationHistory.id],
    }),
  })
);
