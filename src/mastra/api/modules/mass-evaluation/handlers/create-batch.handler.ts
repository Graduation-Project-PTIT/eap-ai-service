import type { Context } from "hono";
import { db } from "../../../db";
import { massEvaluationBatch, evaluationHistory } from "../../../db/schema";
import {
  createBatchInput,
  CreateBatchInput,
} from "../types/create-batch.input";
import { massEvaluationService } from "../services/mass-evaluation.service";
import { classServiceClient } from "../services/class-service-client";
import { fileServiceClient } from "../services/file-service-client";
import { validateFilenames, formatFilenameErrors } from "../utils/filename-validator";

const startBatchHandler = async (c: Context) => {
  const input = await c.req.json<CreateBatchInput>();
  const user = c.get("user");
  const authHeader = c.req.header("Authorization");
  const userToken = authHeader?.replace("Bearer ", "") || "";

  const validatedInput = createBatchInput.parse(input);

  // Map to store fileKey -> studentCode
  const fileKeyToStudentCode = new Map<string, string>();

  // If classId is provided, validate filenames and students
  if (validatedInput.classId) {
    try {
      // 1. Fetch class details to get classCode
      const classInfo = await classServiceClient.getClassById(
        validatedInput.classId,
        userToken
      );

      if (!classInfo) {
        return c.json(
          {
            error: `Class with ID ${validatedInput.classId} not found`,
          },
          404
        );
      }

      // 2. Get file metadata for all fileKeys to extract original filenames
      const fileMetadataMap = await fileServiceClient.getFilesByIds(
        validatedInput.fileKeys,
        userToken
      );

      // 3. Parse filenames to extract student codes
      const filenames: string[] = [];
      const fileKeyToFilename = new Map<string, string>();

      for (const fileKey of validatedInput.fileKeys) {
        const fileMetadata = fileMetadataMap.get(fileKey);
        if (!fileMetadata) {
          return c.json(
            {
              error: `File with ID ${fileKey} not found`,
            },
            404
          );
        }
        filenames.push(fileMetadata.originalName);
        fileKeyToFilename.set(fileKey, fileMetadata.originalName);
      }

      // 4. Validate filename format and extract student codes
      const { validStudentCodes, invalidFilenames } = validateFilenames(
        filenames,
        classInfo.code
      );

      if (invalidFilenames.length > 0) {
        return c.json(
          {
            error: formatFilenameErrors(invalidFilenames, classInfo.code),
            invalidFilenames,
          },
          400
        );
      }

      // 5. Validate all student codes exist in the class
      const invalidStudents = await classServiceClient.validateStudentsInClass(
        validatedInput.classId,
        validStudentCodes,
        userToken
      );

      if (invalidStudents.length > 0) {
        return c.json(
          {
            error: `The following students are not in class ${classInfo.name}:\n${invalidStudents.map((code) => `  - ${code}`).join("\n")}\n\nPlease check the filenames and try again.`,
            invalidStudents,
          },
          400
        );
      }

      // 6. Build fileKey -> studentCode mapping
      for (const fileKey of validatedInput.fileKeys) {
        const filename = fileKeyToFilename.get(fileKey)!;
        const studentCode = filename.split("-")[1]; // Extract student code from filename
        fileKeyToStudentCode.set(fileKey, studentCode);
      }
    } catch (error) {
      console.error("Class validation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to validate class information";
      return c.json(
        {
          error: errorMessage,
        },
        500
      );
    }
  }

  // Create batch
  const batch = await db
    .insert(massEvaluationBatch)
    .values({
      questionDescription: validatedInput.questionDescription,
      status: "pending",
      createdBy: user.sub,
      classId: validatedInput.classId,
    })
    .returning();

  // Create evaluation tasks with studentCode if available
  const evaluationTasks = validatedInput.fileKeys.map((fileKey) => ({
    questionDescription: validatedInput.questionDescription,
    batchId: batch[0].id,
    fileKey,
    status: "pending",
    userId: user.sub,
    workflowMode: "sync",
    preferredFormat: "mermaid",
    studentCode: fileKeyToStudentCode.get(fileKey),
  }));

  const tasks = await db
    .insert(evaluationHistory)
    .values(evaluationTasks)
    .returning();

  for (const task of tasks) {
    // Start tasks processing in background
    massEvaluationService.processEvaluationTask(batch[0].id, task.id, c);
  }

  return c.json(batch[0], 201);
};

export default startBatchHandler;
