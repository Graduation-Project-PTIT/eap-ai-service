/**
 * Request timing and logging utilities for chatbot handler
 */

import { SendMessageInput } from "../types/send-message.input";

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(7);
}

/**
 * Log the start of a chat request
 */
export function logRequestStart(
  requestId: string,
  input: SendMessageInput,
  userId: string
): void {
  console.log(`\n🚀 [${requestId}] ========== CHAT REQUEST START ==========`);
  console.log(`⏱️  [${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`👤 [${requestId}] User: ${userId}`);
  console.log(`📨 [${requestId}] Conversation: ${input.conversationId}`);
  console.log(`💬 [${requestId}] Message: ${input.message}`);
  console.log(`🔍 [${requestId}] Enable Search: ${input.enableSearch}`);
}

/**
 * Log successful completion of a chat request
 */
export function logRequestComplete(
  requestId: string,
  startTime: number,
  result: {
    success: boolean;
    blocked?: boolean;
    schema?: any;
    erdSchema?: any;
    ddl?: string;
    diagramType?: string | null;
  }
): void {
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const seconds = (totalTime / 1000).toFixed(2);

  console.log(
    `\n✅ [${requestId}] ========== CHAT REQUEST COMPLETE ==========`
  );
  console.log(`⏱️  [${requestId}] Total Time: ${totalTime}ms (${seconds}s)`);
  console.log(`📊 [${requestId}] Response Preview:`, {
    success: result.success,
    blocked: result.blocked ?? false,
    hasSchema: !!result.schema,
    hasErdSchema: !!result.erdSchema,
    hasDdl: !!result.ddl,
    diagramType: result.diagramType ?? null,
  });
  console.log(
    `🏁 [${requestId}] ============================================\n`
  );
}

/**
 * Log error in a chat request
 */
export function logRequestError(
  requestId: string,
  startTime: number,
  error: Error
): void {
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const seconds = (totalTime / 1000).toFixed(2);

  console.error(
    `\n❌ [${requestId}] ========== CHAT REQUEST FAILED ==========`
  );
  console.error(`⏱️  [${requestId}] Failed after: ${totalTime}ms (${seconds}s)`);
  console.error(`❌ [${requestId}] Error:`, error.message);
  console.error(`❌ [${requestId}] Stack:`, error.stack);
  console.error(
    `🏁 [${requestId}] ============================================\n`
  );
}
