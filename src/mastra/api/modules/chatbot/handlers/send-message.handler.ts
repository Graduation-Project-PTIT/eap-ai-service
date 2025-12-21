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
  const seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Type for intent classification result
 */
interface IntentClassification {
  intent: "schema" | "side-question";
  schemaIntent: "create" | "modify" | null;
  diagramType: "ERD" | "PHYSICAL_DB" | null;
  domain: string | null;
  domainConfidence: number | null;
  confidence: number;
}

const sendMessageHandler = async (c: Context) => {
  try {
    const input = await c.req.json<SendMessageInput>();
    const user = c.get("user");
    const mastra = c.get("mastra");

    console.log(
      `📨 Received chat message for conversation: ${input.conversationId}`
    );
    console.log(`💬 Message: ${input.message}`);

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
      console.log(`📝 Creating new conversation: ${conversationId}`);
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
      console.log(`✅ Conversation created successfully`);
    } else {
      console.log(`📖 Using existing conversation: ${conversationId}`);
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

    console.log(`📚 Fetched ${messages.length} previous messages for context`);

    // 5. Classify intent first to determine if we need to include schema DDL
    const intentClassificationAgent = mastra.getAgent(
      "intentClassificationAgent"
    );

    const intentOutputSchema = await import("zod").then((z) =>
      z.z.object({
        intent: z.z.enum(["schema", "side-question"]),
        schemaIntent: z.z.enum(["create", "modify"]).nullable(),
        diagramType: z.z.enum(["ERD", "PHYSICAL_DB"]).nullable(),
        domain: z.z.string().nullable(),
        domainConfidence: z.z.number().min(0).max(1).nullable(),
        confidence: z.z.number(),
      })
    );

    const intentResult = await intentClassificationAgent.generate(message, {
      output: intentOutputSchema,
    });

    const resultWithObject = intentResult as any;

    // Declare intentClassification with proper type
    let intentClassification: IntentClassification;

    // Check if the agent generated a structured response
    if (!resultWithObject || !resultWithObject.object) {
      console.error(
        "⚠️ Agent failed to generate structured intent classification response"
      );
      console.error("⚠️ Intent result:", intentResult);

      // Default to schema/create/ERD on error
      intentClassification = {
        intent: "schema" as const,
        schemaIntent: "create" as const,
        diagramType: "ERD" as const, // Default to ERD
        domain: null,
        domainConfidence: null,
        confidence: 0.5,
      };

      console.log(
        `🎯 Intent (default): ${intentClassification.intent}, Schema Intent: ${intentClassification.schemaIntent}, Diagram Type: ${intentClassification.diagramType}`
      );
    } else {
      intentClassification = resultWithObject.object as IntentClassification;

      // Default to ERD if diagramType is null for schema intent
      if (
        intentClassification.intent === "schema" &&
        !intentClassification.diagramType
      ) {
        intentClassification.diagramType = "ERD";
      }

      console.log(
        `🎯 Intent: ${intentClassification.intent}, Schema Intent: ${intentClassification.schemaIntent}, Diagram Type: ${intentClassification.diagramType}, Domain: ${intentClassification.domain}`
      );
    }

    // 6. Check existing schemas
    const hasCurrentErdSchema =
      conversation[0].currentErdSchema &&
      Object.keys(conversation[0].currentErdSchema as object).length > 0;
    const hasCurrentPhysicalSchema =
      conversation[0].currentSchema && conversation[0].currentDdl;
    const hasAnySchema = hasCurrentErdSchema || hasCurrentPhysicalSchema;
    const shouldSaveDomain =
      !conversation[0].domain &&
      intentClassification.domain &&
      intentClassification.domainConfidence &&
      intentClassification.domainConfidence >= 0.7;

    if (shouldSaveDomain) {
      console.log(
        `💾 Saving domain: "${intentClassification.domain}" (confidence: ${intentClassification.domainConfidence})`
      );
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
      conversation[0].domainConfidence =
        intentClassification.domainConfidence!.toString();
    }

    // 7. Prevention Logic: Block ERD generation when Physical DB already exists
    if (
      hasCurrentPhysicalSchema &&
      intentClassification.diagramType === "ERD" &&
      intentClassification.schemaIntent === "create"
    ) {
      console.log(
        `🚫 User attempting to create ERD when Physical DB schema already exists`
      );

      const instructionMessage = `I notice this conversation already has a **Physical Database schema**. Converting from Physical DB back to ERD is not supported as it would lose important implementation details.\n\n**Please create a new conversation** for your ERD design.\n\nThis ensures:\n- Cleaner separation between conceptual (ERD) and physical design\n- Better tracking of each schema's evolution\n- More accurate AI responses for each context\n\nYou can start a new conversation anytime from the chat interface!`;

      await db.insert(chatbotMessageHistory).values([
        {
          conversationId,
          role: "user",
          content: message,
          enableSearch: enableSearch ?? false,
          intent: "schema",
        },
        {
          conversationId,
          role: "assistant",
          content: instructionMessage,
          intent: "side-question",
        },
      ]);

      await db
        .update(chatbotConversationHistory)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(chatbotConversationHistory.id, conversationId));

      return c.json({
        success: true,
        conversationId,
        response: instructionMessage,
        schema: conversation[0].currentSchema,
        erdSchema: conversation[0].currentErdSchema,
        ddl: conversation[0].currentDdl,
        blocked: true,
      });
    }

    // 7b. Check if user is trying to create a NEW schema when one already exists (same diagram type)
    if (
      hasAnySchema &&
      intentClassification.schemaIntent === "create" &&
      conversation[0].diagramType === intentClassification.diagramType
    ) {
      console.log(
        `🚫 User attempting to create new schema in conversation with existing schema`
      );

      const instructionMessage = `I notice this conversation already has an existing ${hasCurrentErdSchema ? "ERD" : "database"} schema. To keep conversations focused and organized, I recommend:\n\n**Create a New Conversation** for your new schema design.\n\nThis approach helps because:\n- Each conversation specializes in one domain/schema\n- Easier to track the evolution of each schema\n- Cleaner context and better AI responses\n- Simpler to reference and export specific schemas\n\nWould you like to:\n1. **Modify the existing schema** in this conversation, or\n2. **Create a new conversation** for your new schema design?\n\nYou can start a new conversation anytime from the chat interface!`;

      await db.insert(chatbotMessageHistory).values([
        {
          conversationId,
          role: "user",
          content: message,
          enableSearch: enableSearch ?? false,
          intent: "schema",
        },
        {
          conversationId,
          role: "assistant",
          content: instructionMessage,
          intent: "side-question",
        },
      ]);

      await db
        .update(chatbotConversationHistory)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(chatbotConversationHistory.id, conversationId));

      return c.json({
        success: true,
        conversationId,
        response: instructionMessage,
        schema: conversation[0].currentSchema,
        erdSchema: conversation[0].currentErdSchema,
        ddl: conversation[0].currentDdl,
        blocked: true,
      });
    }

    // 7c. Check if user is trying to MODIFY a schema when none exists yet
    if (!hasAnySchema && intentClassification.schemaIntent === "modify") {
      console.log(
        `🚫 User attempting to modify schema but no schema exists yet`
      );

      const instructionMessage = `I notice you're trying to modify a schema, but this conversation doesn't have one yet.\n\n**Please create a schema first** before making modifications.\n\nYou can start by describing what you want to create. For example:\n- "Create an ERD for an e-commerce system"\n- "Design a database schema for a hotel booking application"\n- "I need an entity-relationship diagram for managing student records"\n\nOnce the schema is created, you'll be able to modify it!`;

      await db.insert(chatbotMessageHistory).values([
        {
          conversationId,
          role: "user",
          content: message,
          enableSearch: enableSearch ?? false,
          intent: "schema",
        },
        {
          conversationId,
          role: "assistant",
          content: instructionMessage,
          intent: "side-question",
        },
      ]);

      await db
        .update(chatbotConversationHistory)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(chatbotConversationHistory.id, conversationId));

      return c.json({
        success: true,
        conversationId,
        response: instructionMessage,
        schema: { entities: [] },
        erdSchema: null,
        ddl: "",
        blocked: true,
      });
    }

    // 7d. Handle ERD → Physical DB conversion request
    const isConversionRequest =
      hasCurrentErdSchema &&
      !hasCurrentPhysicalSchema &&
      intentClassification.diagramType === "PHYSICAL_DB" &&
      intentClassification.schemaIntent === "create";

    // 8. Build context for LLM (separate from search query)
    let fullContext = "";

    // Include ERD schema context for modification
    if (
      hasCurrentErdSchema &&
      intentClassification.schemaIntent === "modify" &&
      intentClassification.diagramType === "ERD"
    ) {
      console.log(`🗄️  Including ERD schema for MODIFICATION`);
      fullContext += `# Current ERD Schema (MODIFICATION MODE)\n\n`;
      fullContext += `**Instruction:** The user wants to MODIFY the existing ERD below. Update only the specified entities/attributes/relationships.\n\n`;
      fullContext += `\`\`\`json\n${JSON.stringify(conversation[0].currentErdSchema, null, 2)}\n\`\`\`\n\n`;
      fullContext += `---\n\n`;
    }

    // Include Physical DB schema context for modification
    if (
      hasCurrentPhysicalSchema &&
      intentClassification.schemaIntent === "modify" &&
      intentClassification.diagramType === "PHYSICAL_DB"
    ) {
      console.log(
        `🗄️  Including schema for MODIFICATION (${conversation[0].currentDdl?.length} chars)`
      );

      fullContext += `# Current Database Schema (MODIFICATION MODE)\n\n`;
      fullContext += `**Instruction:** The user wants to MODIFY the existing schema below. Update only the specified tables/fields.\n\n`;
      fullContext += `\`\`\`sql\n${conversation[0].currentDdl}\n\`\`\`\n\n`;
      fullContext += `---\n\n`;
    }

    // 9. Add conversation history in chronological order
    if (messages.length > 0) {
      fullContext += `# Conversation History\n\n`;

      messages.forEach((msg) => {
        const timeAgo = msg.createdAt ? `(${getTimeAgo(msg.createdAt)})` : "";
        fullContext += `**${msg.role === "user" ? "User" : "Assistant"}** ${timeAgo}:\n${msg.content}\n\n`;
      });

      fullContext += `---\n\n`;
    }

    // 10. Add current user message
    fullContext += `# Current Request\n\n${message}`;

    console.log(
      `📝 Context built for ${intentClassification.schemaIntent || intentClassification.intent}`
    );
    console.log(`📏 Full context length: ${fullContext.length} characters`);
    console.log(`📏 Current message length: ${message.length} characters`);
    console.log(`🏷️  Domain context: ${conversation[0].domain || "none"}`);

    // 11. Insert user message
    await db.insert(chatbotMessageHistory).values({
      conversationId,
      role: "user",
      content: message,
      enableSearch: enableSearch ?? false,
    });
    console.log(`💾 User message saved to database`);

    // 12. Handle ERD → Physical DB conversion
    if (isConversionRequest) {
      console.log(`🔄 Converting ERD to Physical DB schema...`);

      // Import and execute the conversion step
      const erdToPhysicalStep = await import(
        "../../../../workflows/chatbot/conversion/erd-to-physical-step"
      ).then((m) => m.default);

      const conversionWorkflow = mastra.getWorkflow("dbGenerationWorkflow");
      if (!conversionWorkflow) {
        return c.json({ error: "Conversion workflow not found" }, 500);
      }

      // Use the schema generation agent to convert
      const conversionResult = await (async () => {
        const agent = mastra.getAgent("schemaGenerationAgent");
        const ddlAgent = mastra.getAgent("ddlScriptGenerationAgent");

        const conversionPrompt = `Convert the following ERD schema (Chen notation) to a Physical Database schema.

## Conversion Rules:
1. **Multivalued Attributes** → Create separate child/junction tables
2. **Composite Attributes** → Flatten to individual columns
3. **Derived Attributes** → EXCLUDE from physical schema
4. **Weak Entities** → Regular tables with composite FK to identifying entity
5. **Relationships** → Foreign key constraints with proper cardinality

## ERD Schema to Convert:
\`\`\`json
${JSON.stringify(conversation[0].currentErdSchema, null, 2)}
\`\`\`

Generate a Physical Database schema. Return the schema with all tables, columns, primary keys, foreign keys, and proper SQL types.`;

        const dbInformationGenerationSchema = await import(
          "../../../../../schemas/dbInformationGenerationSchema"
        ).then((m) => m.default);
        const outputSchema = dbInformationGenerationSchema.extend({
          explanation: (await import("zod")).z.string(),
        });

        const schemaResult = await agent.generate(conversionPrompt, {
          output: outputSchema,
        });
        const schemaObject = (schemaResult as any).object;

        // Generate DDL
        const ddlResult = await ddlAgent.generate([
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify({ entities: schemaObject.entities }),
              },
            ],
          },
        ]);

        let ddlScript = ddlResult.text?.trim() || "";
        if (ddlScript.startsWith("```sql")) {
          ddlScript = ddlScript
            .replace(/^```sql\n?/, "")
            .replace(/\n?```$/, "");
        } else if (ddlScript.startsWith("```")) {
          ddlScript = ddlScript.replace(/^```\n?/, "").replace(/\n?```$/, "");
        }

        return {
          physicalSchema: { entities: schemaObject.entities },
          ddlScript,
          agentResponse:
            schemaObject.explanation +
            "\n\n---\n\n✅ **Conversion complete!** Your ERD has been successfully converted to a Physical Database schema.",
        };
      })();

      // Save messages and update conversation
      await db.insert(chatbotMessageHistory).values([
        {
          conversationId,
          role: "user",
          content: message,
          enableSearch: enableSearch ?? false,
          intent: "schema",
        },
        {
          conversationId,
          role: "assistant",
          content: conversionResult.agentResponse,
          schemaSnapshot: conversionResult.physicalSchema,
          ddlSnapshot: conversionResult.ddlScript,
          intent: "schema",
        },
      ]);

      await db
        .update(chatbotConversationHistory)
        .set({
          currentSchema: conversionResult.physicalSchema,
          currentDdl: conversionResult.ddlScript,
          diagramType: "PHYSICAL_DB",
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));

      return c.json({
        success: true,
        conversationId,
        response: conversionResult.agentResponse,
        schema: conversionResult.physicalSchema,
        erdSchema: conversation[0].currentErdSchema,
        ddl: conversionResult.ddlScript,
        diagramType: "PHYSICAL_DB",
      });
    }

    // 13. Start the chatbot workflow with structured input
    const workflow = mastra.getWorkflow("chatbotWorkflow");
    if (!workflow) {
      console.error(`❌ Chatbot workflow not found`);
      return c.json({ error: "Chatbot workflow not found" }, 500);
    }

    const run = await workflow.createRunAsync();
    console.log(`🚀 Starting workflow run: ${run.runId}`);

    const workflowResult = await run.start({
      inputData: {
        userMessage: message,
        fullContext: fullContext,
        domain: conversation[0].domain || null,
        schemaContext: conversation[0].currentDdl || null,
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        intent: intentClassification.intent,
        schemaIntent: intentClassification.schemaIntent,
        diagramType: intentClassification.diagramType,
        confidence: intentClassification.confidence,
        enableSearch: enableSearch ?? false,
      },
    });

    console.log(`🏁 Workflow completed with status: ${workflowResult.status}`);

    // 14. Check workflow success
    const success = workflowResult.status === "success";

    if (!success) {
      console.error(`❌ Workflow failed:`, workflowResult);
      return c.json(
        {
          success: false,
          conversationId,
          response: "An error occurred processing your message",
          schema: conversation[0].currentSchema || { entities: [] },
          erdSchema: conversation[0].currentErdSchema || null,
          ddl: conversation[0].currentDdl || "",
          runId: run.runId,
        },
        500
      );
    }

    // Extract the actual result from the branch step wrapper
    const rawResult = workflowResult.result as any;

    console.log(`🔍 Raw workflow result keys:`, Object.keys(rawResult));

    // The branch result is nested under the step ID
    const result = (rawResult.erdWorkflowBranchStep ||
      rawResult.schemaWorkflowBranchStep ||
      rawResult.sideQuestionStep ||
      rawResult) as {
      response?: string;
      updatedSchema?: any;
      updatedErdSchema?: any;
      ddlScript?: string;
      agentResponse?: string;
      isSideQuestion: boolean;
      isSchemaGeneration: boolean;
      isErdGeneration?: boolean;
    };

    const isErdGeneration = result.isErdGeneration === true;
    const isPhysicalGeneration = result.isSchemaGeneration === true;

    console.log(
      `📤 Preparing response - isErd: ${isErdGeneration}, isPhysical: ${isPhysicalGeneration}, isSideQuestion: ${result.isSideQuestion}`
    );

    // 15. Prepare response data based on workflow branch
    const responseText = result.response || result.agentResponse || "";

    // Determine schemas based on generation type
    let schema = conversation[0].currentSchema || { entities: [] };
    let erdSchema = conversation[0].currentErdSchema || null;
    let ddl = conversation[0].currentDdl || "";
    let diagramType = conversation[0].diagramType || null;

    if (isErdGeneration && result.updatedErdSchema) {
      erdSchema = result.updatedErdSchema;
      diagramType = "ERD";
    } else if (isPhysicalGeneration && result.updatedSchema) {
      schema = result.updatedSchema;
      ddl = result.ddlScript || "";
      diagramType = "PHYSICAL_DB";
    }

    // 16. Add suggestion for ERD → Physical DB conversion on initial ERD creation
    let finalResponseText = responseText;
    const isInitialErdCreation = isErdGeneration && !hasCurrentErdSchema;
    if (isInitialErdCreation) {
      finalResponseText +=
        '\n\n---\n\n💡 **Tip:** Would you like me to convert this ERD to a Physical Database schema with DDL? Just ask "Convert to Physical DB" or "Generate database tables".';
    }

    // 17. Insert assistant message
    await db.insert(chatbotMessageHistory).values({
      conversationId,
      role: "assistant",
      content: finalResponseText,
      schemaSnapshot: isPhysicalGeneration
        ? result.updatedSchema
        : isErdGeneration
          ? result.updatedErdSchema
          : null,
      ddlSnapshot: isPhysicalGeneration ? result.ddlScript : null,
      runId: run.runId,
      intent: result.isSideQuestion ? "side-question" : "schema",
    });
    console.log(`💾 Assistant message saved to database`);

    // 18. Update conversation with appropriate schema
    if (isErdGeneration) {
      await db
        .update(chatbotConversationHistory)
        .set({
          currentErdSchema: result.updatedErdSchema,
          diagramType: "ERD",
          lastRunId: run.runId,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
      console.log(`✅ Conversation updated with new ERD schema`);
    } else if (isPhysicalGeneration) {
      await db
        .update(chatbotConversationHistory)
        .set({
          currentSchema: result.updatedSchema,
          currentDdl: result.ddlScript,
          diagramType: "PHYSICAL_DB",
          lastRunId: run.runId,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
      console.log(`✅ Conversation updated with new Physical DB schema`);
    } else {
      await db
        .update(chatbotConversationHistory)
        .set({
          lastRunId: run.runId,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(chatbotConversationHistory.id, conversationId));
      console.log(`✅ Conversation timestamp updated`);
    }

    // 19. Return response with both schemas
    return c.json({
      success: true,
      conversationId,
      response: finalResponseText,
      schema,
      erdSchema,
      ddl,
      diagramType,
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
