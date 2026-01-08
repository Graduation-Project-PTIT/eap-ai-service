import { Context } from "hono";
import { db } from "../../../db";
import { chatbotConversationHistory } from "../../../db/schema";
import { eq } from "drizzle-orm";
import {
  UpdateSchemaInput,
  updateSchemaInputSchema,
} from "../types/update-schema.input";

const updateSchemaHandler = async (c: Context) => {
  try {
    const conversationId = c.req.param("conversationId");
    const input = await c.req.json<UpdateSchemaInput>();
    const user = c.get("user");
    const mastra = c.get("mastra");

    const validatedInput = updateSchemaInputSchema.parse({
      ...input,
      conversationId,
    });
    const { schemaJson, regenerateDDL } = validatedInput;

    const conversation = await db
      .select()
      .from(chatbotConversationHistory)
      .where(eq(chatbotConversationHistory.id, conversationId))
      .limit(1);

    if (!conversation[0]) {
      return c.json({ error: "Conversation not found" }, 404);
    }

    if (conversation[0].userId !== user.sub) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    let ddlScript = conversation[0].currentDdl || "";

    if (regenerateDDL) {
      try {
        const ddlAgent = mastra.getAgent("ddlScriptGenerationAgent");

        if (!ddlAgent) {
          return c.json({ error: "DDL generation agent not available" }, 500);
        }

        const ddlResult = await ddlAgent.generate(
          `Generate PostgreSQL DDL script for this schema: ${JSON.stringify(schemaJson)}`
        );

        ddlScript = (ddlResult as any).text || "";
      } catch (ddlError: any) {
        console.error("DDL generation failed:", ddlError.message);
      }
    }

    const updateData: any = {
      currentSchema: schemaJson,
      updatedAt: new Date(),
    };

    if (regenerateDDL && ddlScript) {
      updateData.currentDdl = ddlScript;
    }

    await db
      .update(chatbotConversationHistory)
      .set(updateData)
      .where(eq(chatbotConversationHistory.id, conversationId));

    return c.json({
      success: true,
      conversationId,
      schema: schemaJson,
      ddl: ddlScript,
      message: "Schema updated successfully",
    });
  } catch (error: any) {
    console.error("❌ Error in updateSchemaHandler:", error);
    console.error("❌ Error stack:", error.stack);

    if (error.name === "ZodError") {
      return c.json(
        {
          success: false,
          error: "Invalid input",
          details: error.errors,
        },
        400
      );
    }

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

export default updateSchemaHandler;
