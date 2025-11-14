import { registerApiRoute } from "@mastra/core/server";
import { memory } from "../mastra/memory";

/**
 * Custom API Routes for Database Design Service
 *
 * These routes replace the Express.js server with Mastra's built-in routing.
 * All routes use Mastra's memory system for conversation persistence.
 *
 * Note: Mastra reserves /api/* paths, so we use /chat/* instead
 */

/**
 * POST /chat
 *
 * Main chat endpoint - handles conversational database schema design
 *
 * Request Body:
 * {
 *   "conversationId": "string",
 *   "message": "string",
 *   "enableSearch": boolean (optional, default: true)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "string",
 *   "response": "string",
 *   "schema": { "entities": [...] },
 *   "ddl": "string"
 * }
 */
export const chatRoute = registerApiRoute("/chat", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const body = await c.req.json();

      const { conversationId, message, enableSearch = true } = body;

      // Validate input
      if (!conversationId || typeof conversationId !== "string") {
        return c.json(
          {
            error: "conversationId is required and must be a string",
          },
          400
        );
      }

      if (
        !message ||
        typeof message !== "string" ||
        message.trim().length === 0
      ) {
        return c.json(
          {
            error: "message is required and must be a non-empty string",
          },
          400
        );
      }

      // Validate enableSearch if provided
      if (enableSearch !== undefined && typeof enableSearch !== "boolean") {
        return c.json(
          {
            error: "enableSearch must be a boolean value",
          },
          400
        );
      }

      console.log(
        `\n📨 Received chat message for conversation: ${conversationId}`
      );
      console.log(`💬 Message: ${message}`);
      console.log(`🔍 Search enabled: ${enableSearch}`);

      // Get the workflow
      const workflow = mastra.getWorkflow("dbGenerationWorkflow");

      if (!workflow) {
        console.error("❌ Workflow not found: dbGenerationWorkflow");
        return c.json(
          {
            error: "DB generation workflow not found",
          },
          500
        );
      }

      // Create a new workflow run
      const run = await workflow.createRunAsync();
      console.log(`🚀 Created workflow run: ${run.runId}`);

      // Start the workflow with memory identifiers
      // The workflow and agents will handle memory automatically
      const result = await run.start({
        inputData: {
          threadId: conversationId,
          resourceId: conversationId, // Using conversationId as resourceId
          userMessage: message,
          enableSearch, // Pass search toggle to workflow
        },
      });

      // Handle the result
      if (result.status === "success") {
        console.log(`✅ Workflow completed successfully`);

        const workflowResult = result.result as {
          threadId: string;
          resourceId: string;
          updatedSchema: any;
          ddlScript: string;
          agentResponse: string;
        };

        // Return response to user
        return c.json({
          success: true,
          conversationId: workflowResult.threadId,
          response: workflowResult.agentResponse,
          schema: workflowResult.updatedSchema,
          ddl: workflowResult.ddlScript,
          runId: run.runId,
        });
      } else {
        console.error(`❌ Workflow failed with status: ${result.status}`);
        return c.json(
          {
            error: "Workflow execution failed",
            status: result.status,
            runId: run.runId,
          },
          500
        );
      }
    } catch (error: any) {
      console.error("❌ Error handling chat message:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error.message,
        },
        500
      );
    }
  },
});

/**
 * GET /chat/:conversationId
 *
 * Get conversation state including current schema
 *
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "string",
 *   "exists": boolean,
 *   "schema": { "entities": [...] } | null,
 *   "messageCount": number
 * }
 */
export const getConversationRoute = registerApiRoute("/chat/:conversationId", {
  method: "GET",
  handler: async (c) => {
    try {
      const conversationId = c.req.param("conversationId");

      if (!conversationId) {
        return c.json(
          {
            error: "conversationId is required",
          },
          400
        );
      }

      console.log(`📖 Getting conversation: ${conversationId}`);

      // Get thread from memory
      const thread = await memory.getThreadById({ threadId: conversationId });

      if (!thread) {
        return c.json({
          success: true,
          conversationId,
          exists: false,
          schema: null,
          message: "No conversation found",
        });
      }

      // Extract schema from working memory if available
      const workingMem = thread.metadata?.workingMemory as string | undefined;
      let schema = null;

      // Try to parse schema from working memory
      if (workingMem) {
        const jsonMatch = workingMem.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          try {
            schema = JSON.parse(jsonMatch[1]);
          } catch (e) {
            console.warn("Failed to parse schema from working memory");
          }
        }
      }

      return c.json({
        success: true,
        conversationId,
        exists: true,
        schema,
        thread: {
          title: thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error getting conversation:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error.message,
        },
        500
      );
    }
  },
});

/**
 * POST /chat/reset
 *
 * Reset/clear a conversation (delete thread and messages)
 *
 * Request Body:
 * {
 *   "conversationId": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "string",
 *   "message": "Conversation reset successfully"
 * }
 */
export const resetConversationRoute = registerApiRoute("/chat/reset", {
  method: "POST",
  handler: async (c) => {
    try {
      const body = await c.req.json();
      const { conversationId } = body;

      if (!conversationId) {
        return c.json(
          {
            error: "conversationId is required",
          },
          400
        );
      }

      console.log(`🔄 Resetting conversation: ${conversationId}`);

      // Delete the thread (this should cascade delete messages)
      await memory.deleteThread(conversationId);

      console.log(`✅ Conversation reset successfully`);

      return c.json({
        success: true,
        conversationId,
        message: "Conversation reset successfully",
      });
    } catch (error: any) {
      console.error("❌ Error resetting conversation:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error.message,
        },
        500
      );
    }
  },
});

/**
 * GET /health
 *
 * Health check endpoint
 *
 * Response:
 * {
 *   "status": "healthy",
 *   "timestamp": "ISO datetime"
 * }
 */
export const healthRoute = registerApiRoute("/health", {
  method: "GET",
  handler: async (c) => {
    return c.json({
      status: "healthy",
      service: "Database Design Service",
      timestamp: new Date().toISOString(),
    });
  },
});
