import z from "zod";

export interface CreateBatchInput {
  questionDescription: string;
  fileKeys: string[];
}

export const createBatchInput = z.object({
  questionDescription: z.string(),
  fileKeys: z.array(z.string()),
});
