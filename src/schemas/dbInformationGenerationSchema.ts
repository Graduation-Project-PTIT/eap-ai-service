import z from "zod";

const dbInformationGenerationSchema = z.object({
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
          foreignKeyTable: z.string().nullable().default(null),
          foreignKeyAttribute: z.string().nullable().default(null),
          relationType: z
            .enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"])
            .nullable()
            .default(null),
        })
      ),
    })
  ),
});

export default dbInformationGenerationSchema;
