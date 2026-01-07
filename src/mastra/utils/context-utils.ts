export interface ContextMessage {
  role: string;
  content: string;
  createdAt?: string;
}

function getTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

export function formatConversationHistory(messages: ContextMessage[]): string {
  if (!messages || messages.length === 0) {
    return "";
  }

  let formatted = `# Conversation History\n\n`;

  messages.forEach((msg) => {
    const timeAgo = msg.createdAt ? `(${getTimeAgo(msg.createdAt)})` : "";
    const role = msg.role === "user" ? "User" : "Assistant";
    formatted += `**${role}** ${timeAgo}:\n${msg.content}\n\n`;
  });

  formatted += `---\n\n`;
  return formatted;
}

export function buildSchemaReferenceContext(
  erdSchema: any | null,
  ddl: string | null
): string {
  let context = "";

  if (erdSchema && Object.keys(erdSchema).length > 0) {
    console.log(`🗄️  Including ERD schema as REFERENCE`);
    context += `# Current ERD Schema (Reference)\n\n`;
    context += `**Context:** The following ERD schema exists in this conversation. Use it to answer questions about the design, entities, relationships, and structure.\n\n`;
    context += `\`\`\`json\n${JSON.stringify(erdSchema, null, 2)}\n\`\`\`\n\n`;
    context += `---\n\n`;
  }

  if (ddl && ddl.length > 0) {
    console.log(`🗄️  Including Physical DB schema as REFERENCE (${ddl.length} chars)`);
    context += `# Current Database Schema (Reference)\n\n`;
    context += `**Context:** The following database schema exists in this conversation. Use it to answer questions about tables, columns, constraints, and implementation details.\n\n`;
    context += `\`\`\`sql\n${ddl}\n\`\`\`\n\n`;
    context += `---\n\n`;
  }

  return context;
}

export function buildSchemaModificationContext(
  diagramType: "ERD" | "PHYSICAL_DB",
  erdSchema: any | null,
  ddl: string | null
): string {
  let context = "";

  if (diagramType === "ERD" && erdSchema && Object.keys(erdSchema).length > 0) {
    console.log(`🗄️  Including ERD schema for MODIFICATION`);
    context += `# Current ERD Schema (MODIFICATION MODE)\n\n`;
    context += `**Instruction:** The user wants to MODIFY the existing ERD below. Update only the specified entities/attributes/relationships.\n\n`;
    context += `\`\`\`json\n${JSON.stringify(erdSchema, null, 2)}\n\`\`\`\n\n`;
    context += `---\n\n`;
  }

  if (diagramType === "PHYSICAL_DB" && ddl && ddl.length > 0) {
    console.log(`🗄️  Including Physical DB schema for MODIFICATION (${ddl.length} chars)`);
    context += `# Current Database Schema (MODIFICATION MODE)\n\n`;
    context += `**Instruction:** The user wants to MODIFY the existing schema below. Update only the specified tables/fields.\n\n`;
    context += `\`\`\`sql\n${ddl}\n\`\`\`\n\n`;
    context += `---\n\n`;
  }

  return context;
}

export function buildSideQuestionContext(input: {
  userMessage: string;
  erdSchema: any | null;
  ddl: string | null;
  conversationHistory: ContextMessage[];
}): string {
  const { userMessage, erdSchema, ddl, conversationHistory } = input;

  let context = "";

  // Include schema as reference
  context += buildSchemaReferenceContext(erdSchema, ddl);

  // Add conversation history
  context += formatConversationHistory(conversationHistory);

  // Add current request
  context += `# Current Request\n\n${userMessage}`;

  console.log(`📝 Side question context built (${context.length} chars)`);

  return context;
}

export function buildSchemaGenerationContext(input: {
  userMessage: string;
  schemaIntent: "create" | "modify" | null;
  diagramType: "ERD" | "PHYSICAL_DB";
  erdSchema: any | null;
  ddl: string | null;
  conversationHistory: ContextMessage[];
}): string {
  const {
    userMessage,
    schemaIntent,
    diagramType,
    erdSchema,
    ddl,
    conversationHistory,
  } = input;

  let context = "";

  if (schemaIntent === "modify") {
    context += buildSchemaModificationContext(diagramType, erdSchema, ddl);
  }

  context += formatConversationHistory(conversationHistory);

  context += `# Current Request\n\n${userMessage}`;

  console.log(
    `📝 Schema generation context built for ${schemaIntent || "create"} (${context.length} chars)`
  );

  return context;
}
