import { z } from "zod";
import { MessageType } from "./conversation.service";

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

function buildContextualMessage(
  currentMessage: string,
  conversationHistory: MessageType[]
): string {
  if (!conversationHistory || conversationHistory.length === 0) {
    return currentMessage;
  }

  const recentMessages = conversationHistory.slice(-3);

  const lastMessage = recentMessages[recentMessages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") {
    return currentMessage;
  }

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
