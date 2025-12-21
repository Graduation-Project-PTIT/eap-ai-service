import { z } from "zod";

/**
 * ERD Attribute Schema for Generation
 * Supports Chen notation attribute types for AI-generated ERD schemas
 */
const erdGenerationAttributeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.string(),

    // Attribute classification flags
    primaryKey: z.boolean(),
    foreignKey: z.boolean().optional(),
    unique: z.boolean().optional(),
    nullable: z.boolean().optional(),

    // ERD-specific attribute properties (Chen notation)
    isMultivalued: z.boolean().optional(), // Double ellipse - can hold multiple values
    isDerived: z.boolean().optional(), // Dashed ellipse - computed from other attributes
    isComposite: z.boolean().optional(), // Has sub-attributes (e.g., Address -> Street, City, Zip)

    // Composite attribute support - recursive definition
    subAttributes: z.array(erdGenerationAttributeSchema).optional(),

    // Optional metadata
    description: z.string().optional(),
    defaultValue: z.string().optional(),
  })
);

/**
 * ERD Entity Schema for Generation
 * Supports weak entities in Chen notation
 */
const erdGenerationEntitySchema = z.object({
  name: z.string(),
  attributes: z.array(erdGenerationAttributeSchema),

  // Entity classification (Chen notation)
  isWeakEntity: z.boolean(), // Double rectangle - depends on another entity

  // Weak entity relationship
  identifyingEntity: z.string().optional(), // The strong entity this weak entity depends on

  // Optional metadata
  description: z.string().optional(),
});

/**
 * ERD Relationship Schema for Generation
 * Supports participation constraints in Chen notation
 */
const erdGenerationRelationshipSchema = z.object({
  name: z.string(),
  sourceEntity: z.string(),
  targetEntity: z.string(),
  relationType: z.enum([
    "one-to-one",
    "one-to-many",
    "many-to-one",
    "many-to-many",
  ]),

  // Participation constraints (Chen notation)
  sourceParticipation: z.enum(["total", "partial"]).optional(), // Total = double line, Partial = single line
  targetParticipation: z.enum(["total", "partial"]).optional(),

  // Relationship attributes (relationships can have their own attributes)
  attributes: z.array(erdGenerationAttributeSchema).optional(),

  // Optional metadata
  description: z.string().optional(),
});

/**
 * ERD Information Generation Schema
 * Complete schema for AI-generated ERD schemas
 * Following Chen notation conventions for ERD modeling
 * 
 * Note: Unlike erdInformationExtractSchema, this does NOT include
 * the `type: z.literal("ERD")` field as it's only used for generation,
 * not for type discrimination during extraction.
 */
const erdInformationGenerationSchema = z.object({
  entities: z.array(erdGenerationEntitySchema),

  // Explicit relationships between entities
  relationships: z.array(erdGenerationRelationshipSchema),
});

export default erdInformationGenerationSchema;

// Export sub-schemas for reuse
export {
  erdGenerationAttributeSchema,
  erdGenerationEntitySchema,
  erdGenerationRelationshipSchema,
};

