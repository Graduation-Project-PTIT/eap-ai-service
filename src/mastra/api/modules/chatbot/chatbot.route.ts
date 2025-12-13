import { registerApiRoute } from "@mastra/core/server";
import sendMessageHandler from "./handlers/send-message.handler";
import getConversationHandler from "./handlers/get-conversation.handler";
import listConversationsHandler from "./handlers/list-conversations.handler";
import updateSchemaHandler from "./handlers/update-schema.handler";

export const sendMessageRoute = registerApiRoute("/ai/chat", {
  method: "POST",
  handler: sendMessageHandler,
});

export const listConversationsRoute = registerApiRoute("/ai/conversations", {
  method: "GET",
  handler: listConversationsHandler,
});

export const getConversationRoute = registerApiRoute(
  "/ai/chat/:conversationId",
  {
    method: "GET",
    handler: getConversationHandler,
  }
);

export const updateSchemaRoute = registerApiRoute(
  "/ai/chat/:conversationId/schema",
  {
    method: "PUT",
    handler: updateSchemaHandler,
  }
);

export default [
  sendMessageRoute,
  listConversationsRoute,
  getConversationRoute,
  updateSchemaRoute,
];
