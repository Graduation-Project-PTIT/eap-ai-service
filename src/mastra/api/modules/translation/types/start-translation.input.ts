import z from "zod";

export interface StartTranslationInput {
  evaluationReport: string;
  targetLanguage: string;
}

export const startTranslationInputSchema = z.object({
  evaluationReport: z.string(),
  targetLanguage: z.string(),
});
