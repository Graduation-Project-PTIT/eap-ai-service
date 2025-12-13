import z from "zod";

export interface UpdateSchemaInput {
  conversationId: string;
  schemaJson: {
    entities: Array<{
      name: string;
      attributes: Array<{
        name: string;
        type: string;
        primaryKey?: boolean;
        foreignKey?: boolean;
        unique?: boolean;
        nullable?: boolean;
        foreignKeyTable?: string | null;
        foreignKeyAttribute?: string | null;
        relationType?: string | null;
        references?: {
          table: string;
          column: string;
        };
      }>;
    }>;
  };
  regenerateDDL?: boolean;
}

export const updateSchemaInputSchema = z.object({
  conversationId: z.string().uuid(),
  schemaJson: z.object({
    entities: z.array(
      z.object({
        name: z.string().min(1),
        attributes: z.array(
          z.object({
            name: z.string().min(1),
            type: z.string().min(1),
            primaryKey: z.boolean().optional(),
            foreignKey: z.boolean().optional(),
            unique: z.boolean().optional(),
            nullable: z.boolean().optional(),
            // Support both old and new FK formats
            foreignKeyTable: z.string().nullable().optional(),
            foreignKeyAttribute: z.string().nullable().optional(),
            relationType: z.string().nullable().optional(),
            references: z
              .object({
                table: z.string(),
                column: z.string(),
              })
              .optional(),
          })
        ),
      })
    ),
  }),
  regenerateDDL: z.boolean().default(true).optional(),
});
