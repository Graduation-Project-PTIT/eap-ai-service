/**
 * Schema Validation Service
 * Handles validation and blocking logic for schema operations
 */

import { ConversationType } from "./conversation.service";
import { IntentClassification } from "./intent-classification.service";

/**
 * Result of schema validation
 */
export interface SchemaValidationResult {
  valid: boolean;
  blockedMessage?: string;
  blockedResponse?: {
    schema: any;
    erdSchema: any;
    ddl: string;
  };
}

export function checkExistingSchemas(conversation: ConversationType): {
  hasCurrentErdSchema: boolean;
  hasCurrentPhysicalSchema: boolean;
  hasAnySchema: boolean;
} {
  const hasCurrentErdSchema = Boolean(
    conversation.currentErdSchema &&
      Object.keys(conversation.currentErdSchema as object).length > 0
  );
  const hasCurrentPhysicalSchema = Boolean(
    conversation.currentSchema && conversation.currentDdl
  );
  const hasAnySchema = hasCurrentErdSchema || hasCurrentPhysicalSchema;

  return { hasCurrentErdSchema, hasCurrentPhysicalSchema, hasAnySchema };
}

export function shouldSaveDomain(
  conversation: ConversationType,
  intent: IntentClassification
): boolean {
  return (
    !conversation.domain &&
    !!intent.domain &&
    !!intent.domainConfidence &&
    intent.domainConfidence >= 0.7
  );
}

export function isConversionRequest(
  conversation: ConversationType,
  intent: IntentClassification
): boolean {
  const { hasCurrentErdSchema, hasCurrentPhysicalSchema } =
    checkExistingSchemas(conversation);

  const isConversion =
    hasCurrentErdSchema &&
    !hasCurrentPhysicalSchema &&
    intent.diagramType === "PHYSICAL_DB" &&
    intent.schemaIntent === "create";

  console.log(`🔍 Conversion Request Check:
    - Has ERD schema: ${hasCurrentErdSchema}
    - Has Physical schema: ${hasCurrentPhysicalSchema}
    - Intent diagram type: ${intent.diagramType}
    - Intent schema type: ${intent.schemaIntent}
    - Intent confidence: ${intent.confidence}
    - Conversation domain: ${conversation.domain || "null"} (will be preserved)
    - Is conversion: ${isConversion ? "✅ YES" : "❌ NO"}
  `);

  return isConversion;
}

/**
 * Validate schema request and return blocking message if needed
 */
export function validateSchemaRequest(
  conversation: ConversationType,
  intent: IntentClassification
): SchemaValidationResult {
  const { hasCurrentErdSchema, hasCurrentPhysicalSchema, hasAnySchema } =
    checkExistingSchemas(conversation);

  // Case 1: Block ERD creation when Physical DB already exists
  if (
    hasCurrentPhysicalSchema &&
    intent.diagramType === "ERD" &&
    intent.schemaIntent === "create"
  ) {
    console.log(
      `🚫 User attempting to create ERD when Physical DB schema already exists`
    );

    const blockedMessage = `I notice this conversation already has a **Physical Database schema**. Converting from Physical DB back to ERD is not supported as it would lose important implementation details.\n\n**Please create a new conversation** for your ERD design.\n\nThis ensures:\n- Cleaner separation between conceptual (ERD) and physical design\n- Better tracking of each schema's evolution\n- More accurate AI responses for each context\n\nYou can start a new conversation anytime from the chat interface!`;

    return {
      valid: false,
      blockedMessage,
      blockedResponse: {
        schema: conversation.currentSchema,
        erdSchema: conversation.currentErdSchema,
        ddl: conversation.currentDdl || "",
      },
    };
  }

  // Case 2: Block new schema creation when one already exists (same diagram type)
  if (
    hasAnySchema &&
    intent.schemaIntent === "create" &&
    conversation.diagramType === intent.diagramType
  ) {
    console.log(
      `🚫 User attempting to create new schema in conversation with existing schema`
    );

    const blockedMessage = `I notice this conversation already has an existing ${hasCurrentErdSchema ? "ERD" : "database"} schema. To keep conversations focused and organized, I recommend:\n\n**Create a New Conversation** for your new schema design.\n\nThis approach helps because:\n- Each conversation specializes in one domain/schema\n- Easier to track the evolution of each schema\n- Cleaner context and better AI responses\n- Simpler to reference and export specific schemas\n\nWould you like to:\n1. **Modify the existing schema** in this conversation, or\n2. **Create a new conversation** for your new schema design?\n\nYou can start a new conversation anytime from the chat interface!`;

    return {
      valid: false,
      blockedMessage,
      blockedResponse: {
        schema: conversation.currentSchema,
        erdSchema: conversation.currentErdSchema,
        ddl: conversation.currentDdl || "",
      },
    };
  }

  // Case 3: Block modification when no schema exists
  if (!hasAnySchema && intent.schemaIntent === "modify") {
    console.log(`🚫 User attempting to modify schema but no schema exists yet`);

    const blockedMessage = `I notice you're trying to modify a schema, but this conversation doesn't have one yet.\n\n**Please create a schema first** before making modifications.\n\nYou can start by describing what you want to create. For example:\n- "Create an ERD for an e-commerce system"\n- "Design a database schema for a hotel booking application"\n- "I need an entity-relationship diagram for managing student records"\n\nOnce the schema is created, you'll be able to modify it!`;

    return {
      valid: false,
      blockedMessage,
      blockedResponse: {
        schema: { entities: [] },
        erdSchema: null,
        ddl: "",
      },
    };
  }

  // All validations passed
  return { valid: true };
}
