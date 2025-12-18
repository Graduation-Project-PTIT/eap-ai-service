import { Context } from "hono";
import { db } from "../../../db";
import {
  chatbotConversationHistory,
  chatbotMessageHistory,
} from "../../../db/schema";
import { eq, asc } from "drizzle-orm";
import {
  SendMessageInput,
  sendMessageInputSchema,
} from "../types/send-message.input";

/**
 * Helper: Calculate time ago from timestamp
 */
function getTimeAgo(date: Date | null): string {
  if (!date) return "recently";
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const sendMessageHandler = async (c: Context) => {
  try {
    const input = await c.req.json<SendMessageInput>();
    const user = c.get("user");
    const mastra = c.get("mastra");

    const validatedInput = sendMessageInputSchema.parse(input);
    const { conversationId, message, enableSearch } = validatedInput;

    // 1. Check if conversation exists
    let conversation = await db
      .select()
      .from(chatbotConversationHistory)
      .where(eq(chatbotConversationHistory.id, conversationId))
      .limit(1);

    // 2. If NEW conversation - create it
    if (!conversation[0]) {
      const conversationTitle =
        message.length > 50 ? message.substring(0, 50) + "..." : message;

      conversation = await db
        .insert(chatbotConversationHistory)
        .values({
          id: conversationId,
          userId: user.sub,
          conversationTitle,
          status: "active",
        })
        .returning();
    } else {
    }

    // 3. Verify user ownership
    if (conversation[0].userId !== user.sub) {
      console.error(
        `❌ Unauthorized access attempt for conversation: ${conversationId}`
      );
      return c.json({ error: "Unauthorized" }, 403);
    }

    // 4. Fetch conversation history for context (exclude JSONB fields)
    const messages = await db
      .select({
        role: chatbotMessageHistory.role,
        content: chatbotMessageHistory.content,
        createdAt: chatbotMessageHistory.createdAt,
      })
      .from(chatbotMessageHistory)
      .where(eq(chatbotMessageHistory.conversationId, conversationId))
      .orderBy(asc(chatbotMessageHistory.createdAt))
      .limit(20);

    // 5. Classify intent first to determine if we need to include schema DDL
    const intentClassificationAgent = mastra.getAgent("intentClassificationAgent");
    
    const intentOutputSchema = await import("zod").then(z => z.z.object({
      intent: z.z.enum(["schema", "side-question"]),
      schemaIntent: z.z.enum(["create", "modify"]).nullable(),
      domain: z.z.string().nullable(),
      domainConfidence: z.z.number().min(0).max(1).nullable(),
      confidence: z.z.number(),
    }));
    
    const intentResult = await intentClassificationAgent.generate(message, {
      output: intentOutputSchema,
    });
    
    const resultWithObject = intentResult as any;
    
    // Declare intentClassification with proper type
    let intentClassification: {
      intent: "schema" | "side-question";
      schemaIntent: "create" | "modify" | null;
      domain: string | null;
      domainConfidence: number | null;
      confidence: number;
    };
    
    // Check if the agent generated a structured response
    if (!resultWithObject || !resultWithObject.object) {
      console.error("⚠️ Agent failed to generate structured intent classification response");
      console.error("⚠️ Intent result:", intentResult);
      
      // Default to schema/create on error (similar to intent-classification-step.ts)
      intentClassification = {
        intent: "schema" as const,
        schemaIntent: "create" as const,
        domain: null,
        domainConfidence: null,
        confidence: 0.5,
      };
    } else {
      intentClassification = resultWithObject.object as {
        intent: "schema" | "side-question";
        schemaIntent: "create" | "modify" | null;
        domain: string | null;
        domainConfidence: number | null;
        confidence: number;
      };
      
      console.log(`🎯 ${intentClassification.intent}/${intentClassification.schemaIntent || 'none'} (domain: ${intentClassification.domain || 'none'})`);
    }

    // 6. Save domain on first schema message (if extracted with high confidence)
    const hasCurrentSchema = conversation[0].currentSchema && conversation[0].currentDdl;
    const shouldSaveDomain = 
      !conversation[0].domain && 
      intentClassification.domain && 
      intentClassification.domainConfidence && 
      intentClassification.domainConfidence >= 0.7;
    
    if (shouldSaveDomain) {
      console.log(`💾 Saving domain: "${intentClassification.domain}" (confidence: ${intentClassification.domainConfidence})`);
      await db
        .update(chatbotConversationHistory)
        .set({
          domain: intentClassification.domain!,
          domainConfidence: intentClassification.domainConfidence!.toString(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
      
      // Update local conversation object
      conversation[0].domain = intentClassification.domain!;
      conversation[0].domainConfidence = intentClassification.domainConfidence!.toString();
    }
    
    // 7. Check if user is trying to create a NEW schema when one already exists
    if (hasCurrentSchema && intentClassification.schemaIntent === "create") {
      console.log(`🚫 User attempting to create new schema in conversation with existing schema`);
      
      const instructionMessage = `I notice this conversation already has an existing database schema. To keep conversations focused and organized, I recommend:\n\n**Create a New Conversation** for your new schema design.\n\nThis approach helps because:\n- Each conversation specializes in one domain/schema\n- Easier to track the evolution of each schema\n- Cleaner context and better AI responses\n- Simpler to reference and export specific schemas\n\nWould you like to:\n1. **Modify the existing schema** in this conversation, or\n2. **Create a new conversation** for your new schema design?\n\nYou can start a new conversation anytime from the chat interface!`;
      
      // Save both user and assistant messages
      await db.insert(chatbotMessageHistory).values({
        conversationId,
        role: "user",
        content: message,
        enableSearch: enableSearch ?? false,
        intent: "schema",
      });
      
      await db.insert(chatbotMessageHistory).values({
        conversationId,
        role: "assistant",
        content: instructionMessage,
        intent: "side-question",
      });
      
      // Update conversation timestamp
      await db
        .update(chatbotConversationHistory)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
      
      return c.json({
        success: true,
        conversationId,
        response: instructionMessage,
        schema: conversation[0].currentSchema,
        ddl: conversation[0].currentDdl,
        blocked: true, // Indicate that schema creation was blocked
      });
    }

    // 7b. Check if user is trying to MODIFY a schema when none exists yet
    if (!hasCurrentSchema && intentClassification.schemaIntent === "modify") {
      console.log(`🚫 User attempting to modify schema but no schema exists yet`);
      
      const instructionMessage = `I notice you're trying to modify a database schema, but this conversation doesn't have a schema yet.\n\n**Please create a schema first** before making modifications.\n\nYou can start by describing what kind of database you want to create. For example:\n- "Create a database schema for an e-commerce system"\n- "Design a schema for a hotel booking application"\n- "I need a database for managing student records"\n\nOnce the schema is created, you'll be able to modify it by adding, removing, or updating tables and fields!`;
      
      // Save both user and assistant messages
      await db.insert(chatbotMessageHistory).values({
        conversationId,
        role: "user",
        content: message,
        enableSearch: enableSearch ?? false,
        intent: "schema",
      });
      
      await db.insert(chatbotMessageHistory).values({
        conversationId,
        role: "assistant",
        content: instructionMessage,
        intent: "side-question",
      });
      
      // Update conversation timestamp
      await db
        .update(chatbotConversationHistory)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
      
      return c.json({
        success: true,
        conversationId,
        response: instructionMessage,
        schema: { entities: [] },
        ddl: "",
        blocked: true, // Indicate that schema modification was blocked
      });
    }

    // 8. Build context for LLM (separate from search query)
    let fullContext = "";

    if (hasCurrentSchema && intentClassification.schemaIntent === "modify") {
      console.log(`🗄️  Including schema for MODIFICATION (${conversation[0].currentDdl?.length} chars)`);
      
      fullContext += `# Current Database Schema (MODIFICATION MODE)\n\n`;
      fullContext += `**Instruction:** The user wants to MODIFY the existing schema below. Update only the specified tables/fields.\n\n`;
      fullContext += `\`\`\`sql\n${conversation[0].currentDdl}\n\`\`\`\n\n`;
      fullContext += `---\n\n`;
    }

    // 9. Add conversation history in chronological order
    if (messages.length > 0) {
      fullContext += `# Conversation History\n\n`;
      
      messages.forEach((msg) => {
        const timeAgo = msg.createdAt ? `(${getTimeAgo(msg.createdAt)})` : '';
        fullContext += `**${msg.role === "user" ? "User" : "Assistant"}** ${timeAgo}:\n${msg.content}\n\n`;
      });
      
      fullContext += `---\n\n`;
    }

    // 10. Add current user message
    fullContext += `# Current Request\n\n${message}`;

    // 11. Insert user message
    await db.insert(chatbotMessageHistory).values({
      conversationId,
      role: "user",
      content: message,
      enableSearch: enableSearch ?? false,
    });

    // 12. Start the chatbot workflow with structured input
    const workflow = mastra.getWorkflow("chatbotWorkflow");
    if (!workflow) {
      console.error(`❌ Chatbot workflow not found`);
      return c.json({ error: "Chatbot workflow not found" }, 500);
    }

    const run = await workflow.createRunAsync();

    const workflowResult = await run.start({
      inputData: {
        // Separate concerns: user message for tools, full context for LLM
        userMessage: message,
        fullContext: fullContext,
        domain: conversation[0].domain || null,
        schemaContext: conversation[0].currentDdl || null,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        intent: intentClassification.intent,
        schemaIntent: intentClassification.schemaIntent,
        confidence: intentClassification.confidence,
        enableSearch: enableSearch ?? false,
      },
    });

    console.log(`🏁 Workflow completed with status: ${workflowResult.status}`);

    // 12. Check workflow success
    const success = workflowResult.status === "success";

    if (!success) {
      console.error(`❌ Workflow failed:`, workflowResult);
      return c.json(
        {
          success: false,
          conversationId,
          response: "An error occurred processing your message",
          schema: conversation[0].currentSchema || { entities: [] },
          ddl: conversation[0].currentDdl || "",
          runId: run.runId,
        },
        500
      );
    }

    // Extract the actual result from the branch step wrapper
    const rawResult = workflowResult.result as any;

    // The branch result is nested under the step ID
    const result = (rawResult.schemaWorkflowBranchStep ||
      rawResult.sideQuestionStep ||
      rawResult) as {
      response?: string;
      updatedSchema?: any;
      ddlScript?: string;
      agentResponse?: string;
      isSideQuestion: boolean;
      isSchemaGeneration: boolean;
    };

    // 13. Prepare response data based on workflow branch
    const responseText = result.response || result.agentResponse || "";
    const schema = result.isSchemaGeneration
      ? result.updatedSchema
      : conversation[0].currentSchema || { entities: [] };
    const ddl = result.isSchemaGeneration
      ? result.ddlScript
      : conversation[0].currentDdl || "";

    // 14. Insert assistant message
    await db.insert(chatbotMessageHistory).values({
      conversationId,
      role: "assistant",
      content: responseText,
      schemaSnapshot: result.isSchemaGeneration ? result.updatedSchema : null,
      ddlSnapshot: result.isSchemaGeneration ? result.ddlScript : null,
      runId: run.runId,
      intent: result.isSideQuestion ? "side-question" : "schema",
    });

    // 15. Update conversation
    if (result.isSchemaGeneration) {
      await db
        .update(chatbotConversationHistory)
        .set({
          currentSchema: result.updatedSchema,
          currentDdl: result.ddlScript,
          lastRunId: run.runId,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
    } else {
      await db
        .update(chatbotConversationHistory)
        .set({
          lastRunId: run.runId,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
    }

    // 16. Return response
    return c.json({
      success: true,
      conversationId,
      response: responseText,
      schema,
      ddl,
      runId: run.runId,
    });
  } catch (error: any) {
    console.error("❌ Error in sendMessageHandler:", error);
    console.error("❌ Error stack:", error.stack);
    return c.json(
      {
        success: false,
        error: "Internal server error",
        message: error.message || "Unknown error",
      },
      500
    );
  }
};

export default sendMessageHandler;
