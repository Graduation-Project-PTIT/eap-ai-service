import { z } from "zod";

/**
 * ERD Attribute Schema
 * Matches frontend ERDAttribute type with support for Chen notation attribute types
 */
const erdAttributeSchema: z.ZodType<any> = z.lazy(() =>
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
    subAttributes: z.array(erdAttributeSchema).optional(),

    // Partial key
    partialKey: z.boolean().optional(),

    // Optional metadata
    description: z.string().optional(),
    defaultValue: z.string().optional(),
  })
);

/**
 * ERD Entity Schema
 * Matches frontend ERDEntity type with support for weak entities
 */
const erdEntitySchema = z.object({
  name: z.string(),
  attributes: z.array(erdAttributeSchema),

  // Entity classification (Chen notation)
  isWeakEntity: z.boolean(), // Double rectangle - depends on another entity

  // Weak entity relationship
  identifyingEntity: z.string().optional(), // The strong entity this weak entity depends on

  // Optional metadata
  description: z.string().optional(),
});

/**
 * ERD Relationship Schema
 * Matches frontend ERDRelationship type with participation constraints
 */
const erdRelationshipSchema = z.object({
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

  // Weak entity relationship
  isIdentifying: z.boolean().optional(),

  // Relationship attributes (relationships can have their own attributes)
  attributes: z.array(erdAttributeSchema).optional(),

  // Optional metadata
  description: z.string().optional(),
});

/**
 * ERD Information Extract Schema
 * Complete schema for extracting ERD information from images
 * Following Chen notation conventions for ERD modeling
 */
const erdInformationExtractSchema = z.object({
  type: z.literal("ERD"),
  entities: z.array(erdEntitySchema),

  // Explicit relationships between entities
  relationships: z.array(erdRelationshipSchema),
});

export default erdInformationExtractSchema;

// Export sub-schemas for reuse
export { erdAttributeSchema, erdEntitySchema, erdRelationshipSchema };
