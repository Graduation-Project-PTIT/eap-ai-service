import { z } from "zod";

const dbInformationExtractSchema = z.object({
  type: z.literal("PHYSICAL_DB"),
  entities: z.array(
    z.object({
      name: z.string(),
      attributes: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          primaryKey: z.boolean(),
          foreignKey: z.boolean(),
          unique: z.boolean(),
          nullable: z.boolean(),
          foreignKeyTable: z.string().optional(),
          foreignKeyAttribute: z.string().optional(),
          relationType: z
            .enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"])
            .optional(),
        })
      ),
    })
  ),

  ddlScript: z.string(),
  mermaidDiagram: z.string(),
});

export default dbInformationExtractSchema;
