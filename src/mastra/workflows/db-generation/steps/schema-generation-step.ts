import { createStep } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import { createSchemaGenerationPrompt } from "../../../agents/db-generation/prompts/schema-generation-prompt";
/**
 * Conversational Schema Step
 *
 * This step handles both schema creation and modification using agent memory.
 * The agent automatically retrieves conversation history and working memory,
 * eliminating the need for manual schema passing.
 *
 * Key Features:
 * - Uses threadId and resourceId for memory context
 * - Agent automatically accesses conversation history
 * - Working memory stores current schema state
 * - Dynamic prompt generation based on enableSearch flag (prevents malformed tool calls)
 */
const schemaGenerationStep = createStep({
  id: "schemaGenerationStep",

  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    userMessage: z.string().min(1),
    enableSearch: z.boolean().optional().default(true),
  }),

  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    updatedSchema: erdInformationGenerationSchema,
    agentResponse: z.string(),
  }),

  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("schemaGenerationAgent");

    console.log(`🔄 Processing conversation`);
    console.log(`🧵 Thread ID: ${inputData.threadId}`);
    console.log(`📦 Resource ID: ${inputData.resourceId}`);
    console.log(`📝 User message: ${inputData.userMessage}`);
    console.log(`🔍 Search enabled: ${inputData.enableSearch}`);

    // Start performance timing
    const startTime = Date.now();

    try {
      // Generate context-aware prompt based on enableSearch flag
      // This prevents LLM confusion and malformed function calls
      const dynamicPrompt = createSchemaGenerationPrompt(
        inputData.enableSearch || false
      );

      console.log(
        `📝 Using ${inputData.enableSearch ? "SEARCH-ENABLED" : "NO-SEARCH"} prompt variant`
      );
      console.log(
        `📋 Dynamic prompt length: ${dynamicPrompt.length} characters`
      );
      console.log(`📄 First 500 chars of dynamic prompt:`);
      console.log(dynamicPrompt.substring(0, 500));
      console.log(`📄 Last 300 chars of dynamic prompt:`);
      console.log(dynamicPrompt.substring(dynamicPrompt.length - 300));

      // Prepare agent options
      const agentOptions: any = {
        // Override agent instructions with context-aware prompt
        instructions: dynamicPrompt,

        // Memory context - agent uses this to retrieve conversation history
        memory: {
          resource: inputData.resourceId,
          thread: inputData.threadId,
        },
        // Allow multiple steps for tool calls (increased to handle updateWorkingMemory + search tools)
        maxSteps: 10,
      };

      // Log the actual agent options to verify instructions override
      console.log(`🔧 Agent options keys:`, Object.keys(agentOptions));
      console.log(
        `🔧 Instructions override length:`,
        agentOptions.instructions?.length || 0
      );

      // Control tool usage based on enableSearch
      if (!inputData.enableSearch) {
        console.log(
          `⚠️  Search tools disabled - using simplified prompt without tool instructions`
        );
        // With no-search prompt variant, LLM won't be confused about tool availability
      } else {
        console.log(
          `✅ Search tools enabled - using full prompt with tool usage guidelines`
        );
        // Let agent decide whether to use tools (toolChoice: "auto" is default)
      }

      // Call the agent with memory context
      // NOTE: We removed structured output to allow tool calling
      // NOTE: We disabled working memory to prevent Gemini malformed function call errors
      // The agent will automatically:
      // 1. Retrieve conversation history (last 20 messages) - contains all previous schemas
      // 2. Call search tools if needed (when enableSearch is true)
      // 3. Return JSON response based on prompt instructions
      const result = await agent.generate(inputData.userMessage, agentOptions);

      const duration = Date.now() - startTime;
      console.log(`⏱️  Schema generation took: ${duration}ms`);

      // Log the actual request that was sent to verify instructions were applied
      if (result.request && result.request.body) {
        const requestBody = result.request.body as any;
        if (requestBody.system) {
          console.log(`🤖 ACTUAL SYSTEM PROMPT SENT TO LLM:`);
          console.log(`   Length: ${requestBody.system.length} characters`);
          console.log(
            `   First 500 chars:`,
            requestBody.system.substring(0, 500)
          );
          console.log(
            `   Last 300 chars:`,
            requestBody.system.substring(requestBody.system.length - 300)
          );
        } else if (requestBody.contents) {
          console.log(`🤖 Request body structure:`, Object.keys(requestBody));
          // For Gemini, system instructions might be in a different format
          if (requestBody.systemInstruction) {
            const sysInstr = JSON.stringify(requestBody.systemInstruction);
            console.log(`🤖 ACTUAL SYSTEM INSTRUCTION SENT TO GEMINI:`);
            console.log(`   Length: ${sysInstr.length} characters`);
            console.log(`   Content:`, sysInstr.substring(0, 500));
          }
        }
      }

      // Log tool calls if any
      if (result.steps && result.steps.length > 0) {
        console.log(`🔧 Agent made ${result.steps.length} step(s)`);
        result.steps.forEach((step: any, index: number) => {
          if (step.toolCalls && step.toolCalls.length > 0) {
            console.log(
              `  Step ${index + 1}: Called ${step.toolCalls.length} tool(s)`
            );
            step.toolCalls.forEach((toolCall: any) => {
              console.log(
                `    - ${toolCall.toolName}: ${JSON.stringify(toolCall.args).substring(0, 100)}`
              );
            });
          }
          // Log the text content of each step with more detail
          console.log(`  Step ${index + 1} text:`, {
            exists: !!step.text,
            type: typeof step.text,
            length: step.text ? step.text.length : 0,
            trimmedLength: step.text ? step.text.trim().length : 0,
            preview: step.text ? step.text.substring(0, 200) : "EMPTY",
          });
        });
      } else {
        console.log(`ℹ️  No tool calls made by agent`);
      }

      // Debug main result.text
      console.log(`📋 Main result.text:`, {
        exists: !!result.text,
        type: typeof result.text,
        length: result.text ? result.text.length : 0,
        trimmedLength: result.text ? result.text.trim().length : 0,
        preview: result.text ? result.text.substring(0, 200) : "EMPTY",
      });

      // Get the text response - try multiple sources
      let responseText = result.text || "";

      // If main result.text is empty, try to get from steps
      if (!responseText || responseText.trim().length === 0) {
        if (result.steps && result.steps.length > 0) {
          // Collect all non-empty text from all steps
          const allTexts = result.steps
            .map((step: any) => step.text || "")
            .filter((text: string) => text.trim().length > 0);

          if (allTexts.length > 0) {
            // Use the LAST non-empty text (usually the final response)
            responseText = allTexts[allTexts.length - 1];
            console.log(
              `📝 Using text from collected steps (${responseText.length} chars)`
            );
          }
        }
      }

      // If still empty, check if there's a finishReason
      if (!responseText || responseText.trim().length === 0) {
        console.error(`❌ No text found in result or any steps`);
        console.log(`Result keys:`, Object.keys(result));

        // Try to extract from response object if it exists
        if (result.response && typeof result.response === "object") {
          console.log(`Checking result.response...`);
          const resp = result.response as any;
          if (resp.text) {
            responseText = resp.text;
            console.log(
              `✅ Found text in result.response.text (${responseText.length} chars)`
            );
          } else if (resp.body) {
            console.log(`result.response.body type:`, typeof resp.body);
            console.log(
              `result.response.body content:`,
              JSON.stringify(resp.body, null, 2)
            );
          }
        }

        if (result.steps) {
          result.steps.forEach((step: any, i: number) => {
            console.log(`Step ${i} keys:`, Object.keys(step));
            if (step.response && step.response.text) {
              console.log(
                `Step ${i} has response.text:`,
                step.response.text.substring(0, 200)
              );
            }
            // Check for errors in step
            if (step.finishReason === "error" && step.response) {
              console.error(`❌ Step ${i} finished with ERROR`);
              console.error(
                `Step ${i} response:`,
                JSON.stringify(step.response, null, 2).substring(0, 500)
              );
            }
          });
        }

        // Last resort: check finishReason
        console.log(`FinishReason:`, result.finishReason);

        // If finish reason is error, log more details
        if (result.finishReason === "error") {
          console.error(`❌❌❌ Agent finished with ERROR status`);
          if (result.warnings && result.warnings.length > 0) {
            console.error(`Warnings:`, result.warnings);
          }
          // Try to get error from response
          if (result.response) {
            console.error(
              `Full response object:`,
              JSON.stringify(result.response, null, 2).substring(0, 1000)
            );
          }
        }
      }

      if (!responseText || responseText.trim().length === 0) {
        throw new Error("Agent returned empty response");
      }

      console.log(`📄 Raw response length: ${responseText.length} characters`);

      // Parse JSON from response
      // The prompt instructs the agent to return pure JSON
      let parsedResponse;
      try {
        // Try to parse directly
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        // If direct parse fails, try to extract JSON from markdown code blocks
        const jsonMatch = responseText.match(
          /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
        );
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[1]);
        } else {
          // Try to find JSON object in the text
          const jsonObjectMatch = responseText.match(
            /\{[\s\S]*"entities"[\s\S]*\}/
          );
          if (jsonObjectMatch) {
            parsedResponse = JSON.parse(jsonObjectMatch[0]);
          } else {
            console.error(
              "❌ Failed to parse response:",
              responseText.substring(0, 500)
            );
            throw new Error("Agent did not return valid JSON");
          }
        }
      }

      // Validate the parsed response has required fields
      if (!parsedResponse.entities || !Array.isArray(parsedResponse.entities)) {
        throw new Error("Agent response missing 'entities' array");
      }

      if (!parsedResponse.explanation) {
        throw new Error("Agent response missing 'explanation' field");
      }

      console.log(`✅ Schema generated successfully`);
      console.log(
        `📋 Entities: ${parsedResponse.entities
          .map((e: any) => e.name)
          .join(", ")}`
      );

      return {
        threadId: inputData.threadId,
        resourceId: inputData.resourceId,
        updatedSchema: { entities: parsedResponse.entities },
        agentResponse: parsedResponse.explanation,
      };
    } catch (error) {
      console.error("❌ Failed to generate schema:", error);
      throw new Error(
        `Agent response generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});

export default schemaGenerationStep;
