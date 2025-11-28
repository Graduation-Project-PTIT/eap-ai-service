import z from "zod";

export interface StreamEvaluationInput {
  questionDescription: string;
  fileKey: string;
  workflowMode?: string;
  preferredFormat?: string;
  runId?: string;
}

export const streamEvaluationInputSchema = z.object({
  questionDescription: z.string(),
  fileKey: z.string(),
  workflowMode: z.enum(["standard", "sync"]).default("standard").optional(),
  preferredFormat: z
    .enum(["json", "ddl", "mermaid"])
    .default("mermaid")
    .optional(),
  runId: z.string().nullable().optional().default(null),
});
