import { Agent } from "@mastra/core";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import ddlScriptGenerationPrompt from "./prompts/ddl-script-generation-prompt";
import { gemini25FlashLite } from "../../models/google";

/**
 * DDL Script Generation Agent
 *
 * Generates SQL DDL statements from schema JSON.
 * Uses low temperature for deterministic, precise SQL output.
 * 
 * Memory is simplified as DDL generation is more stateless,
 * but conversation history helps track what was already generated.
 */
const ddlScriptGenerationAgent = new Agent({
  name: "ddlScriptGenerationAgent",
  instructions: ddlScriptGenerationPrompt,
  model: gemini25FlashLite,
  memory: new Memory({
    storage: new LibSQLStore({
      url: ":memory:",
    }),
    options: {
      // Keep last 10 messages - DDL generation is more stateless
      lastMessages: 10,
      
      // Disable semantic recall for DDL agent (not needed for SQL generation)
      semanticRecall: false,
      
      // Working memory disabled - DDL generation is deterministic
      workingMemory: {
        enabled: false,
      },
    },
  }),
});

export default ddlScriptGenerationAgent;
