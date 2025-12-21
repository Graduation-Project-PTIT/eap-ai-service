import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import dbInformationGenerationSchema from "../../../../schemas/dbInformationGenerationSchema";

/**
 * ERD to Physical DB Conversion Step
 *
 * This step converts an ERD schema (Chen notation) to a Physical DB schema.
 * It uses AI to handle the conversion with proper handling of:
 * - Multivalued attributes → junction/child tables
 * - Composite attributes → flattened columns
 * - Derived attributes → excluded (computed at query time)
 * - Weak entities → regular tables with composite FK
 * - Relationships → foreign key constraints
 */
const erdToPhysicalStep = createStep({
  id: "erdToPhysicalStep",

  inputSchema: z.object({
    erdSchema: erdInformationGenerationSchema,
    userMessage: z.string().optional(),
  }),

  outputSchema: z.object({
    physicalSchema: dbInformationGenerationSchema,
    ddlScript: z.string(),
    agentResponse: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    console.log(`🔄 Converting ERD to Physical DB schema...`);
    console.log(`   - Input entities: ${inputData.erdSchema.entities.length}`);
    console.log(`   - Input relationships: ${inputData.erdSchema.relationships.length}`);

    const agent = mastra.getAgent("schemaGenerationAgent");

    // Build conversion prompt
    const conversionPrompt = `Convert the following ERD schema (Chen notation) to a Physical Database schema.

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
${JSON.stringify(inputData.erdSchema, null, 2)}
\`\`\`

Generate a Physical Database schema following dbInformationGenerationSchema format.
Return the complete schema with all tables, columns, primary keys, foreign keys, and proper SQL types.`;

    // Use the output schema for structured response
    const outputSchema = dbInformationGenerationSchema.extend({
      explanation: z.string().describe("Explanation of the conversion"),
    });

    const result = await agent.generate(conversionPrompt, {
      output: outputSchema,
    });

    const resultWithObject = result as any;

    if (!resultWithObject.object) {
      throw new Error("Agent failed to generate physical schema from ERD");
    }

    const parsedResponse = resultWithObject.object as {
      entities: any[];
      explanation: string;
    };

    console.log(`✅ ERD to Physical conversion completed`);
    console.log(`   - Output entities: ${parsedResponse.entities.length}`);

    // Generate DDL from physical schema
    const ddlAgent = mastra.getAgent("ddlScriptGenerationAgent");
    const ddlResult = await ddlAgent.generate([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({ entities: parsedResponse.entities }),
          },
        ],
      },
    ]);

    let ddlScript = ddlResult.text?.trim() || "";
    if (ddlScript.startsWith("```sql")) {
      ddlScript = ddlScript.replace(/^```sql\n?/, "").replace(/\n?```$/, "");
    } else if (ddlScript.startsWith("```")) {
      ddlScript = ddlScript.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    return {
      physicalSchema: { entities: parsedResponse.entities },
      ddlScript,
      agentResponse: parsedResponse.explanation,
    };
  },
});

export default erdToPhysicalStep;

