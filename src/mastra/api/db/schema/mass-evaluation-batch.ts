import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  real,
} from "drizzle-orm/pg-core";

export const massEvaluationBatch = pgTable("mass_evaluation_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionDescription: text("question_description").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // pending, processing, completed, failed, cancelled
  averageScore: real("average_score"),
  classId: varchar("class_id", { length: 255 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
