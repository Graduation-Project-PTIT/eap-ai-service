/**
 * Database Migration Script for EAP Evaluation Service
 * 
 * This script runs Drizzle ORM migrations against the PostgreSQL database.
 * It's designed to be run as a Kubernetes Job before the application starts.
 * 
 * Features:
 * - Automatic connection retry for K8s environment
 * - Proper error handling and logging
 * - Exit codes for success/failure
 * - Supports both DB_URL and individual DB parameters
 * 
 * Usage:
 *   pnpm run migrate
 * 
 * Environment Variables:
 *   DB_URL - PostgreSQL connection string (primary)
 *   OR
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (fallback)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const MIGRATION_FOLDER = path.join(__dirname, "../src/mastra/api/db");

/**
 * Build database connection string from environment variables
 */
function getDatabaseUrl(): string {
  // Try DB_URL first
  if (process.env.DB_URL) {
    return process.env.DB_URL;
  }

  // Fallback to individual parameters
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "eap_db";
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD || "password";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test database connection with retry logic
 */
async function testConnection(
  sql: postgres.Sql,
  retries = MAX_RETRIES
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Migration] Testing database connection (attempt ${attempt}/${retries})...`);
      await sql`SELECT 1`;
      console.log("[Migration] ✅ Database connection successful");
      return true;
    } catch (error) {
      console.error(`[Migration] ❌ Connection attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`[Migration] Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  
  return false;
}

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  
  console.log("[Migration] ========================================");
  console.log("[Migration] EAP Evaluation Service - Database Migration");
  console.log("[Migration] ========================================");
  console.log(`[Migration] Migration folder: ${MIGRATION_FOLDER}`);
  console.log(`[Migration] Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs
  console.log("[Migration] ========================================\n");

  // Create postgres client
  const sql = postgres(databaseUrl, {
    max: 1, // Single connection for migrations
    onnotice: () => {}, // Suppress notices
  });

  let db;

  try {
    // Test connection with retries
    const connected = await testConnection(sql);
    if (!connected) {
      throw new Error("Failed to connect to database after multiple retries");
    }

    // Create drizzle instance
    db = drizzle(sql);

    // Run migrations
    console.log("[Migration] 🚀 Starting migration process...\n");
    await migrate(db, { migrationsFolder: MIGRATION_FOLDER });
    console.log("\n[Migration] ✅ Migrations completed successfully!");
    console.log("[Migration] ========================================\n");

    // Exit with success
    process.exit(0);
  } catch (error) {
    console.error("\n[Migration] ========================================");
    console.error("[Migration] ❌ Migration failed!");
    console.error("[Migration] ========================================");
    console.error("[Migration] Error details:", error);
    console.error("[Migration] ========================================\n");

    // Exit with failure
    process.exit(1);
  } finally {
    // Close database connection
    if (sql) {
      await sql.end();
      console.log("[Migration] Database connection closed");
    }
  }
}

// Run migrations
runMigrations();

