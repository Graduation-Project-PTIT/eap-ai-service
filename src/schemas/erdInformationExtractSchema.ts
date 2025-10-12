import { z } from "zod";

const erdInformationExtractSchema = z.object({
  // JSON format - structured data
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

  // DDL format - PostgreSQL script
  ddlScript: z.string(),

  // Mermaid format - Mermaid ERD diagram syntax
  mermaidDiagram: z.string(),
});

export default erdInformationExtractSchema;
