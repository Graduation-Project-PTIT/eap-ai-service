import z from "zod";

export interface CreateBatchInput {
  questionDescription: string;
  fileKeys: string[];
  classId?: string;
}

export const createBatchInput = z.object({
  questionDescription: z.string(),
  fileKeys: z.array(z.string()),
  classId: z.string().optional(),
});
