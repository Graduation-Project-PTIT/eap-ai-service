import z from "zod";

export interface SendMessageInput {
  conversationId: string;
  message: string;
  enableSearch?: boolean;
}

export const sendMessageInputSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1),
  enableSearch: z.boolean().default(false).optional(),
});
