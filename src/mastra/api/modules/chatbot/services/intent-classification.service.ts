import { z } from "zod";
import { MessageType } from "./conversation.service";

/**
 * Type for intent classification result
 */
export interface IntentClassification {
  intent: "schema" | "side-question";
  schemaIntent: "create" | "modify" | null;
  diagramType: "ERD" | "PHYSICAL_DB" | null;
  domain: string | null;
  domainConfidence: number | null;
  confidence: number;
}

export const intentOutputSchema = z.object({
  intent: z.enum(["schema", "side-question"]),
  schemaIntent: z.enum(["create", "modify"]).nullable(),
  diagramType: z.enum(["ERD", "PHYSICAL_DB"]).nullable(),
  domain: z.string().nullable(),
  domainConfidence: z.number().min(0).max(1).nullable(),
  confidence: z.number(),
});

const DEFAULT_INTENT: IntentClassification = {
  intent: "schema",
  schemaIntent: "create",
  diagramType: "ERD",
  domain: null,
  domainConfidence: null,
  confidence: 0.5,
};

/**
 * Build contextual message for intent classification
 * Includes conversation history if available to help agent understand context
 */
function buildContextualMessage(
  currentMessage: string,
  conversationHistory: MessageType[]
): string {
  // If no history or empty history, return current message only
  if (!conversationHistory || conversationHistory.length === 0) {
    return currentMessage;
  }

  // Get last few messages (limit to 3 for token efficiency)
  const recentMessages = conversationHistory.slice(-3);

  // Check if last message is from assistant
  const lastMessage = recentMessages[recentMessages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") {
    // No assistant context to leverage, use current message only
    return currentMessage;
  }

  // Build contextual prompt with conversation history
  let contextualPrompt = "Previous conversation:\n";

  recentMessages.forEach((msg) => {
    const role = msg.role === "user" ? "User" : "Assistant";
    contextualPrompt += `${role}: ${msg.content}\n`;
  });

  contextualPrompt += `\nUser: ${currentMessage}`;

  console.log(
    `📝 Built contextual message with ${recentMessages.length} previous messages`
  );

  return contextualPrompt;
}

export async function classifyIntent(
  mastra: any,
  message: string,
  conversationHistory: MessageType[] = []
): Promise<IntentClassification> {
  const intentClassificationAgent = mastra.getAgent(
    "intentClassificationAgent"
  );

  // Build contextual message including history if available
  const messageToClassify = buildContextualMessage(
    message,
    conversationHistory
  );

  console.log(
    `🎯 Classifying intent with ${conversationHistory.length > 0 ? "context" : "no context"}`
  );

  const intentResult = await intentClassificationAgent.generate(
    messageToClassify,
    {
      output: intentOutputSchema,
    }
  );

  const resultWithObject = intentResult as any;

  // Check if the agent generated a structured response
  if (!resultWithObject || !resultWithObject.object) {
    console.error(
      "⚠️ Agent failed to generate structured intent classification response"
    );
    console.error("⚠️ Intent result:", intentResult);

    console.log(
      `🎯 Intent (default): ${DEFAULT_INTENT.intent}, Schema Intent: ${DEFAULT_INTENT.schemaIntent}, Diagram Type: ${DEFAULT_INTENT.diagramType}`
    );

    return DEFAULT_INTENT;
  }

  const intentClassification = resultWithObject.object as IntentClassification;

  // Default to ERD if diagramType is null for schema intent
  if (
    intentClassification.intent === "schema" &&
    !intentClassification.diagramType
  ) {
    intentClassification.diagramType = "ERD";
  }

  console.log(
    `🎯 Intent Classification Result:
    - Intent: ${intentClassification.intent}
    - Schema Intent: ${intentClassification.schemaIntent}
    - Diagram Type: ${intentClassification.diagramType}
    - Extracted Domain: ${intentClassification.domain || "null"}
    - Confidence: ${intentClassification.confidence}
    ${intentClassification.domain === null ? "    ℹ️  Note: Null domain from intent is OK - conversation domain will be preserved" : ""}`
  );

  return intentClassification;
}
