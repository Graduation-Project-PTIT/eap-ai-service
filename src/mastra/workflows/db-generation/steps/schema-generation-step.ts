import { createStep, MastraStorage } from "@mastra/core";
import z from "zod";
import erdInformationGenerationSchema from "../../../../schemas/erdInformationGenerationSchema";
import businessDomainSearchTool from "../../../tools/business-domain-search.tool";
import dbDesignPatternSearchTool from "../../../tools/db-design-pattern-search.tool";
import schemaGenerationPrompt from "../../../agents/db-generation/prompts/schema-generation-prompt";
import {
  SummarizedSearchResult,
  summarizeSearchResult,
  formatSummarizedContext,
} from "../../../utils/content-summarizer";

/**
 * Conversational Schema Step (Optimized)
 *
 * Simplified flow:
 * 1. If enableSearch = true → Execute searches in parallel
 * 2. Summarize full content (80-90% compression)
 * 3. Pass summarized context + user message to LLM
 * 4. LLM returns structured output (Zod validated)
 * 5. If entities array is empty → side question, skip memory update
 * 6. If entities array has data → schema modification, update memory
 */
const schemaGenerationStep = createStep({
  id: "schemaGenerationStep",

  inputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    userMessage: z.string().min(1),
    enableSearch: z.boolean().optional().default(false), // Default to false for simplicity
  }),

  outputSchema: z.object({
    threadId: z.string(),
    resourceId: z.string(),
    updatedSchema: erdInformationGenerationSchema,
    agentResponse: z.string(),
    searchMetadata: z
      .object({
        searchPerformed: z.boolean(),
        businessSearchTokens: z.number().optional(),
        patternSearchTokens: z.number().optional(),
        totalCompressionRatio: z.number().optional(),
      })
      .optional(),
  }),

  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("schemaGenerationAgent");

    console.log(`🔄 Processing schema generation request`);
    console.log(`🧵 Thread: ${inputData.threadId}`);
    console.log(`📦 Resource: ${inputData.resourceId}`);
    console.log(`🔍 Search enabled: ${inputData.enableSearch}`);

    const startTime = Date.now();

    try {
      let searchContext = "";
      let searchMetadata: any = {
        searchPerformed: false,
      };

      // ===== STEP 1: Execute Backend Searches (if enabled) =====
      if (inputData.enableSearch) {
        console.log(`🔍 Executing backend searches...`);

        const searchStartTime = Date.now();

        // Execute BOTH searches in parallel (always do both when enabled)
        // Note: Search engines are smart - we can pass the user message directly
        // They'll extract relevant keywords automatically
        const [businessResult, patternResult] = await Promise.allSettled([
          (businessDomainSearchTool as any).execute({
            context: { domain: inputData.userMessage },
            runtimeContext: {},
          }),
          (dbDesignPatternSearchTool as any).execute({
            context: { pattern: inputData.userMessage },
            runtimeContext: {},
          }),
        ]);

        const searchDuration = Date.now() - searchStartTime;
        console.log(`⏱️  Search execution took: ${searchDuration}ms`);

        // ===== STEP 2: Summarize Search Results =====
        let businessSummary: SummarizedSearchResult | null = null;
        let patternSummary: SummarizedSearchResult | null = null;

        if (businessResult.status === "fulfilled" && businessResult.value) {
          const data = businessResult.value;
          businessSummary = await summarizeSearchResult(
            data.searchQuery,
            data.fullContent,
            "business"
          );
        } else {
          console.warn(
            "⚠️  Business search failed:",
            businessResult.status === "rejected"
              ? businessResult.reason
              : "No result"
          );
        }

        if (patternResult.status === "fulfilled" && patternResult.value) {
          const data = patternResult.value;
          patternSummary = await summarizeSearchResult(
            data.searchQuery,
            data.fullContent,
            "pattern"
          );
        } else {
          console.warn(
            "⚠️  Pattern search failed:",
            patternResult.status === "rejected"
              ? patternResult.reason
              : "No result"
          );
        }

        // ===== STEP 3: Format Summarized Context =====
        searchContext = formatSummarizedContext(
          businessSummary,
          patternSummary
        );

        // Calculate metadata
        const totalOriginal =
          (businessSummary?.originalWords || 0) +
          (patternSummary?.originalWords || 0);
        const totalSummarized =
          (businessSummary?.summarizedWords || 0) +
          (patternSummary?.summarizedWords || 0);

        searchMetadata = {
          searchPerformed: true,
          businessSearchTokens: businessSummary
            ? Math.ceil(businessSummary.summarizedWords * 0.75)
            : undefined,
          patternSearchTokens: patternSummary
            ? Math.ceil(patternSummary.summarizedWords * 0.75)
            : undefined,
          totalCompressionRatio:
            totalOriginal > 0 ? totalSummarized / totalOriginal : 1.0,
        };

        console.log(`📊 Search summary:`);
        console.log(
          `   - Business: ${businessSummary ? `${businessSummary.originalWords} → ${businessSummary.summarizedWords} words` : "failed"}`
        );
        console.log(
          `   - Pattern: ${patternSummary ? `${patternSummary.originalWords} → ${patternSummary.summarizedWords} words` : "failed"}`
        );
        console.log(
          `   - Total compression: ${(searchMetadata.totalCompressionRatio * 100).toFixed(0)}%`
        );
      }

      // ===== STEP 4: Build Enhanced User Message =====
      const enhancedUserMessage = searchContext
        ? `${searchContext}\n\n## User Request\n\n${inputData.userMessage}`
        : inputData.userMessage;

      // ===== STEP 5: Call Agent with Structured Output =====
      console.log(`🤖 Calling LLM with structured output...`);

      const agentOptions: any = {
        instructions: schemaGenerationPrompt,
        memory: {
          resource: inputData.resourceId,
          thread: inputData.threadId,
        },
        // ✅ ENABLE STRUCTURED OUTPUT!
        // The output schema should match what the LLM generates (entities + explanation)
        output: erdInformationGenerationSchema.extend({
          explanation: z
            .string()
            .describe("Detailed explanation of the schema design decisions"),
        }),
      };

      const result = await agent.generate(enhancedUserMessage, agentOptions);

      const totalDuration = Date.now() - startTime;
      console.log(`⏱️  Total processing time: ${totalDuration}ms`);

      // ===== STEP 6: Extract Structured Response =====
      const resultWithObject = result as any;
      if (!resultWithObject.object) {
        throw new Error("Agent failed to generate structured response");
      }

      const parsedResponse = resultWithObject.object as {
        entities: any[];
        explanation: string;
      };

      // Validate that entities array exists
      if (!parsedResponse.entities || !Array.isArray(parsedResponse.entities)) {
        console.error("❌ Invalid response structure:", parsedResponse);
        throw new Error("Agent response missing entities array");
      }

      // ===== STEP 7: Detect Schema Modification by Checking Entities =====
      // Simple and elegant: If agent returns empty entities, it's a side question
      // If agent returns entities, it's a schema creation/modification
      const hasSchemaData = parsedResponse.entities.length > 0;

      console.log(`✅ Schema response received`);
      if (hasSchemaData) {
        console.log(
          `📋 Entities: ${parsedResponse.entities.map((e: any) => e.name).join(", ")}`
        );
        console.log(`🔍 Schema modification detected (entities present)`);
      } else {
        console.log(`💬 Side question detected (no entities returned)`);
      }

      // ===== STEP 8: Conditionally Save Schema to Working Memory =====
      // Only update working memory if the response contains actual schema data
      // This prevents side questions from overwriting the existing schema
      if (hasSchemaData) {
        try {
          const agentMemory = await agent.getMemory();
          if (agentMemory) {
            // Format schema summary for working memory
            const schemaDescription = parsedResponse.entities
              .map(
                (e: any) => `- **${e.name}**: ${e.attributes.length} attributes`
              )
              .join("\n");

            const workingMemoryContent = `# Current Database Schema

## Schema Status
- Status: complete
- Last Modified: ${new Date().toISOString()}
- Total Entities: ${parsedResponse.entities.length}

## Entities
${schemaDescription}

## Recent Changes
${parsedResponse.explanation}

## Full Schema Data
\`\`\`json
${JSON.stringify(parsedResponse.entities, null, 2)}
\`\`\`
`;

            // Create or get thread first
            let thread = await agentMemory.getThreadById({
              threadId: inputData.threadId,
            });

            // If thread doesn't exist, create it
            if (!thread) {
              thread = await agentMemory.createThread({
                threadId: inputData.threadId,
                resourceId: inputData.resourceId,
                title: "Database Schema Design",
                metadata: {
                  workingMemory: workingMemoryContent,
                },
              });
              console.log(`📝 Created new thread with working memory`);
            } else {
              // Update existing thread's working memory via storage
              const storage = (
                agentMemory as unknown as { storage?: MastraStorage }
              ).storage;
              if (storage && storage.updateThread) {
                await storage.updateThread({
                  id: inputData.threadId,
                  title: thread.title || "Database Schema Design",
                  metadata: {
                    ...thread.metadata,
                    workingMemory: workingMemoryContent,
                  },
                });
                console.log(`💾 Updated thread working memory successfully`);
              }
            }
          }
        } catch (memoryError) {
          console.warn(
            `⚠️  Failed to save schema to working memory:`,
            memoryError
          );
          // Don't fail the workflow if memory save fails
        }
      } else {
        console.log(
          `⏭️  Skipping working memory update - request was not schema-related`
        );
        console.log(
          `   Existing schema in working memory is preserved for future modifications`
        );
      }

      // ===== STEP 9: Validate Working Memory State =====
      // Retrieve and print working memory to confirm current state
      try {
        const agentMemory = await agent.getMemory();
        if (agentMemory) {
          const workingMemory = await agentMemory.getWorkingMemory({
            threadId: inputData.threadId,
          });

          if (workingMemory) {
            console.log(`\n📝 === WORKING MEMORY CONTENT ===`);
            console.log(workingMemory);
            console.log(`=== END WORKING MEMORY ===\n`);

            if (!hasSchemaData) {
              console.log(
                `ℹ️  Note: Working memory was NOT updated (preserved from previous state)`
              );
            }
          } else {
            console.log(`⚠️  Working memory is empty`);
          }
        }
      } catch (memoryError) {
        console.warn(
          `⚠️  Failed to retrieve working memory for validation:`,
          memoryError
        );
        // Don't fail the workflow if memory retrieval fails
      }

      return {
        threadId: inputData.threadId,
        resourceId: inputData.resourceId,
        updatedSchema: { entities: parsedResponse.entities },
        agentResponse: parsedResponse.explanation,
        searchMetadata,
      };
    } catch (error) {
      console.error("❌ Schema generation failed:", error);
      throw new Error(
        `Schema generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

export default schemaGenerationStep;
