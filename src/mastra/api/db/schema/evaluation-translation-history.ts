import { relations } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { evaluationHistory } from "./evaluation-history";

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
