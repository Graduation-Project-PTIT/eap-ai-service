import { Agent } from "@mastra/core";
import { google } from "@ai-sdk/google";
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import conversationalSchemaPrompt from "./prompts/conversational-schema-prompt";

/**
 * Conversational Schema Agent
 *
 * This agent is intelligent enough to:
 * 1. CREATE new schemas from scratch (when no existing schema)
 * 2. MODIFY existing schemas based on user requests
 * 3. EXPLAIN design decisions
 * 4. SUGGEST improvements
 *
 * The agent maintains conversation context through memory:
 * - Conversation History: Last 20 messages for immediate context
 * - Working Memory: Tracks current schema state, user preferences
 * - Semantic Recall: Retrieves relevant past design decisions
 *
 * Performance: Uses gemini-2.5-flash for fast response times
 */
export const conversationalSchemaAgent = new Agent({
  name: "conversationalSchemaAgent",
  instructions: conversationalSchemaPrompt,
  model: google("gemini-2.5-flash"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: ":memory:",
    }),
    // Vector storage not needed for in-memory setup
    options: {
      // Conversation History: Keep last 20 messages for context
      lastMessages: 20,
      
      // Working Memory: Track persistent schema design context
      workingMemory: {
        enabled: true,
        scope: "thread", // Per-conversation memory
        template: `# Database Design Session

## Current Schema
\`\`\`json
{
  "entities": []
}
\`\`\`

## Design Preferences
- Naming Convention: [snake_case/camelCase/PascalCase]
- Database Type: [PostgreSQL/MySQL/SQLite/etc]
- ID Strategy: [UUID/Auto-increment]

## Session Notes
- Key decisions made
- Pending modifications
- Important constraints`,
      },
      
      // Semantic Recall: Disabled for in-memory storage simplicity
      // To enable, configure an embedder and use file-based storage
      semanticRecall: false,
    },
  }),
});

export default conversationalSchemaAgent;
