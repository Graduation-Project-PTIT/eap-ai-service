/**
 * Context Builder Service
 * Builds context for LLM from conversation history and current state
 */

import { ConversationType, MessageType } from "./conversation.service";
import { IntentClassification } from "./intent-classification.service";
import { checkExistingSchemas } from "./schema-validation.service";
import { getTimeAgo } from "../utils";

/**
 * Build full context for LLM including schema and conversation history
 */
export function buildFullContext(
  conversation: ConversationType,
  messages: MessageType[],
  intent: IntentClassification,
  currentMessage: string
): string {
  const { hasCurrentErdSchema, hasCurrentPhysicalSchema } =
    checkExistingSchemas(conversation);

  let fullContext = "";

  // Include ERD schema context for modification
  if (
    hasCurrentErdSchema &&
    intent.schemaIntent === "modify" &&
    intent.diagramType === "ERD"
  ) {
    console.log(`🗄️  Including ERD schema for MODIFICATION`);
    fullContext += `# Current ERD Schema (MODIFICATION MODE)\n\n`;
    fullContext += `**Instruction:** The user wants to MODIFY the existing ERD below. Update only the specified entities/attributes/relationships.\n\n`;
    fullContext += `\`\`\`json\n${JSON.stringify(conversation.currentErdSchema, null, 2)}\n\`\`\`\n\n`;
    fullContext += `---\n\n`;
  }

  // Include Physical DB schema context for modification
  if (
    hasCurrentPhysicalSchema &&
    intent.schemaIntent === "modify" &&
    intent.diagramType === "PHYSICAL_DB"
  ) {
    console.log(
      `🗄️  Including schema for MODIFICATION (${conversation.currentDdl?.length} chars)`
    );

    fullContext += `# Current Database Schema (MODIFICATION MODE)\n\n`;
    fullContext += `**Instruction:** The user wants to MODIFY the existing schema below. Update only the specified tables/fields.\n\n`;
    fullContext += `\`\`\`sql\n${conversation.currentDdl}\n\`\`\`\n\n`;
    fullContext += `---\n\n`;
  }

  if (intent.intent === "side-question") {
    if (hasCurrentErdSchema) {
      console.log(`🗄️  Including ERD schema as REFERENCE for side question`);
      fullContext += `# Current ERD Schema (Reference)\n\n`;
      fullContext += `**Context:** The following ERD schema exists in this conversation. Use it to answer questions about the design, relationships, and structure.\n\n`;
      fullContext += `\`\`\`json\n${JSON.stringify(conversation.currentErdSchema, null, 2)}\n\`\`\`\n\n`;
      fullContext += `---\n\n`;
    }

    if (hasCurrentPhysicalSchema) {
      console.log(
        `🗄️  Including Physical DB schema as REFERENCE for side question (${conversation.currentDdl?.length} chars)`
      );
      fullContext += `# Current Database Schema (Reference)\n\n`;
      fullContext += `**Context:** The following database schema exists in this conversation. Use it to answer questions about tables, columns, constraints, and implementation details.\n\n`;
      fullContext += `\`\`\`sql\n${conversation.currentDdl}\n\`\`\`\n\n`;
      fullContext += `---\n\n`;
    }
  }

  // Add conversation history in chronological order
  if (messages.length > 0) {
    fullContext += `# Conversation History\n\n`;

    messages.forEach((msg) => {
      const timeAgo = msg.createdAt ? `(${getTimeAgo(msg.createdAt)})` : "";
      fullContext += `**${msg.role === "user" ? "User" : "Assistant"}** ${timeAgo}:\n${msg.content}\n\n`;
    });

    fullContext += `---\n\n`;
  }

  // Add current user message
  fullContext += `# Current Request\n\n${currentMessage}`;

  console.log(
    `📝 Context built for ${intent.schemaIntent || intent.intent}`
  );
  console.log(`📏 Full context length: ${fullContext.length} characters`);
  console.log(`📏 Current message length: ${currentMessage.length} characters`);
  console.log(`🏷️  Domain context: ${conversation.domain || "none"}`);

  return fullContext;
}
