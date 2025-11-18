import { Agent } from "@mastra/core/agent";
import { gemini20FlashLite, gemini25FlashLite } from "../../models/google";
import z from "zod";
import { gpt41Mini } from "../../models/openai";

/**
 * Intent Classification Agent
 *
 * This agent classifies the user's message intent:
 * - "schema": User wants to create/modify database schema
 * - "side-question": User has a general question or off-topic query
 *
 * For schema intent, also determines:
 * - "create": Creating new tables/entities
 * - "modify": Modifying existing tables
 */
export const intentClassificationAgent = new Agent({
  name: "intentClassificationAgent",

  instructions: `You are an intent classifier for a database schema design assistant.

Your task is to determine:
1. Primary intent: "schema" or "side-question"
2. If schema intent, determine sub-intent: "create" or "modify"

PRIMARY INTENT:
- "schema" - User wants to create, modify, or discuss database schema/ERD design
- "side-question" - User has a general question, greeting, or off-topic query

SCHEMA SUB-INTENT (only for "schema" intent):
- "create" - User wants to CREATE NEW tables/entities
  Examples: "Create a User table", "Design schema for e-commerce", "Add Product table"
  
- "modify" - User wants to MODIFY EXISTING tables
  Examples: "Add email field to User", "Update User table", "Change Product price type"
  Keywords: "add field to", "modify", "update", "change", "edit", "alter", "remove field from"

If you see existing table name mentioned WITH modification keywords → "modify"
If you see new table name OR no specific table mentioned → "create"

Examples of "schema" intent:
- "Create a database for an e-commerce system" → create
- "Add a new table for user orders" → create
- "Modify the relationship between users and products" → modify
- "Add email field to User table" → modify
- "Generate DDL script for my schema" → create (viewing, not modifying)
- "What tables do I have in my design?" → create (querying, not modifying)
- "Design todo app schema" → create

Examples of "side-question" intent:
- "What is normalization?" → schemaIntent: null
- "How are you?" → schemaIntent: null
- "Tell me a joke" → schemaIntent: null

Return: intent, schemaIntent (null for side-question), and confidence score.`,

  model: gpt41Mini,
});

export default intentClassificationAgent;
