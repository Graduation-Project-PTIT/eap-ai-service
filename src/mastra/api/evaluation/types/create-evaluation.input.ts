import z from "zod";

export interface CreateEvaluationInput {
  questionDescription: string;
  erdImageUrl: string;
  workflowMode?: string;
  preferredFormat?: string;
}

export const createEvaluationInputSchema = z.object({
  questionDescription: z.string(),
  erdImageUrl: z.url(),
  workflowMode: z.enum(["standard", "sync"]).default("standard").optional(),
  preferredFormat: z
    .enum(["json", "ddl", "mermaid"])
    .default("mermaid")
    .optional(),
});
