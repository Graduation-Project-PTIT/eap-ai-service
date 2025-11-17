import type { Context } from "hono";
import { db } from "../../../db";
import { massEvaluationBatch, evaluationHistory } from "../../../db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

const getBatchesHandler = async (c: Context) => {
  const user = c.get("user");

  // Get query parameters
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const status = c.req.query("status");
  const sortBy = c.req.query("sortBy") || "createdAt";
  const sortOrder = c.req.query("sortOrder") || "desc";

  // Build where conditions
  const whereConditions = [eq(massEvaluationBatch.createdBy, user.sub)];

  if (status) {
    whereConditions.push(eq(massEvaluationBatch.status, status));
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  // Create a mapping object for valid sort columns
  const sortColumns = {
    id: massEvaluationBatch.id,
    questionDescription: massEvaluationBatch.questionDescription,
    status: massEvaluationBatch.status,
    averageScore: massEvaluationBatch.averageScore,
    createdBy: massEvaluationBatch.createdBy,
    createdAt: massEvaluationBatch.createdAt,
    updatedAt: massEvaluationBatch.updatedAt,
  };

  // Get the column to sort by, default to createdAt if invalid
  const sortColumn =
    sortColumns[sortBy as keyof typeof sortColumns] ||
    massEvaluationBatch.createdAt;

  // Get batches with pagination
  const batches = await db
    .select()
    .from(massEvaluationBatch)
    .where(and(...whereConditions))
    .orderBy(sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
    .limit(limit)
    .offset(offset);

  // Get total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(massEvaluationBatch)
    .where(and(...whereConditions));

  const total = Number(totalResult[0]?.count || 0);

  // Get tasks for each batch to calculate statistics
  const batchesWithStats = await Promise.all(
    batches.map(async (batch) => {
      const tasks = await db
        .select()
        .from(evaluationHistory)
        .where(eq(evaluationHistory.batchId, batch.id));

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(
        (t) => t.status === "completed"
      ).length;
      const failedTasks = tasks.filter((t) => t.status === "failed").length;

      return {
        ...batch,
        totalTasks,
        completedTasks,
        failedTasks,
        tasks,
      };
    })
  );

  return c.json({
    data: batchesWithStats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export default getBatchesHandler;
