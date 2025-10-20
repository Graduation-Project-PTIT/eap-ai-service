import "dotenv/config";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

/**
 * Shared Memory Instance
 * 
 * This memory instance is used across the application for:
 * - API routes (to access thread metadata)
 * - Agents (configured per-agent with their own memory settings)
 * 
 * Uses in-memory LibSQL storage (no persistence across restarts).
 * This is simpler for development and testing.
 * 
 * To use file-based persistence, change url to: "file:./data/memory.db"
 */

const memoryStore = new LibSQLStore({
  url: ":memory:",
});

export const memory = new Memory({
  storage: memoryStore,
});
