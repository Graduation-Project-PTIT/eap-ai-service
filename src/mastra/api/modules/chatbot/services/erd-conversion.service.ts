/**
 * ERD Conversion Service
 * Handles conversion from ERD (Chen notation) to Physical Database schema
 */

import dbInformationGenerationSchema from "../../../../../schemas/dbInformationGenerationSchema";
import { z } from "zod";

/**
 * Result of ERD to Physical DB conversion
 */
export interface ConversionResult {
  physicalSchema: { entities: any[] };
  ddlScript: string;
  agentResponse: string;
}

/**
 * Build the conversion prompt with detailed rules
 */
function buildConversionPrompt(erdSchema: any): string {
  return `Convert the following ERD schema (Chen notation) to a Physical Database schema.

## Conversion Rules:
1. **Multivalued Attributes** → Create separate child/junction tables
   - e.g., User.PhoneNumbers → user_phone_numbers table with FK to users
   
2. **Composite Attributes** → Flatten to individual columns
   - e.g., Address (Street, City, Zip) → street, city, zip columns
   
3. **Derived Attributes** → EXCLUDE from physical schema
   - These are computed at query time (e.g., Age from BirthDate)
   
4. **Weak Entities** → Regular tables with composite FK to identifying entity
   - Include the FK as part of primary key
   
5. **Relationships** → Foreign key constraints with proper cardinality
   - many-to-many → junction table
   - one-to-many → FK on the "many" side
   - one-to-one → FK with UNIQUE constraint
   
6. **Relationship Attributes** → Add to junction table (for M:N) or the appropriate entity table

## SQL Data Types Mapping:
- String, Text → VARCHAR(255) or TEXT
- Number, Integer → INTEGER
- Decimal → DECIMAL(10,2)
- Date → DATE
- DateTime → TIMESTAMP
- Boolean → BOOLEAN
- Email → VARCHAR(255)
- Phone → VARCHAR(20)

## ERD Schema to Convert:
\`\`\`json
${JSON.stringify(erdSchema, null, 2)}
\`\`\`

Generate a Physical Database schema following dbInformationGenerationSchema format.
Return the complete schema with all tables, columns, primary keys, foreign keys, and proper SQL types.`;
}

/**
 * Strip markdown code block wrappers from DDL
 */
function stripDdlCodeBlock(ddl: string): string {
  let result = ddl.trim();
  if (result.startsWith("```sql")) {
    result = result.replace(/^```sql\n?/, "").replace(/\n?```$/, "");
  } else if (result.startsWith("```")) {
    result = result.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }
  return result;
}

/**
 * Convert ERD schema to Physical Database schema
 */
export async function convertErdToPhysicalDb(
  mastra: any,
  erdSchema: any
): Promise<ConversionResult> {
  console.log(`🔄 Converting ERD to Physical DB schema...`);

  const agent = mastra.getAgent("schemaGenerationAgent");
  const ddlAgent = mastra.getAgent("ddlScriptGenerationAgent");

  const conversionPrompt = buildConversionPrompt(erdSchema);

  const outputSchema = dbInformationGenerationSchema.extend({
    explanation: z.string(),
  });

  const schemaResult = await agent.generate(conversionPrompt, {
    output: outputSchema,
  });
  const schemaObject = (schemaResult as any).object;

  if (!schemaObject) {
    throw new Error("Failed to generate physical schema from ERD");
  }

  // Generate DDL from physical schema
  const ddlResult = await ddlAgent.generate([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify({ entities: schemaObject.entities }),
        },
      ],
    },
  ]);

  const ddlScript = stripDdlCodeBlock(ddlResult.text?.trim() || "");

  return {
    physicalSchema: { entities: schemaObject.entities },
    ddlScript,
    agentResponse:
      schemaObject.explanation +
      "\n\n---\n\n✅ **Conversion complete!** Your ERD has been successfully converted to a Physical Database schema.",
  };
}
