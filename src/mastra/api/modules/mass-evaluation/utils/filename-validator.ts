/**
 * Result of parsing a student filename
 */
export interface ParsedFilename {
  isValid: boolean;
  studentCode?: string;
  error?: string;
}

/**
 * Parse and validate a student filename
 * 
 * Expected format: {classCode}-{studentCode}-{anything}.{ext}
 * Example: CS101-ST001-diagram1.png
 * 
 * Rules:
 * - Only first two parts (classCode and studentCode) are validated
 * - The "anything" part can contain hyphens
 * - Validation is case-sensitive
 * - Must have at least 3 parts separated by hyphens (before the extension)
 * 
 * @param filename - The original filename (e.g., "CS101-ST001-diagram1.png")
 * @param classCode - The expected class code (e.g., "CS101")
 * @returns ParsedFilename object with validation result
 */
export function parseStudentFilename(
  filename: string,
  classCode: string
): ParsedFilename {
  // Remove file extension
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return {
      isValid: false,
      error: `Filename "${filename}" has no file extension`,
    };
  }

  const nameWithoutExt = filename.substring(0, lastDotIndex);
  const extension = filename.substring(lastDotIndex + 1);

  // Validate extension
  const validExtensions = ["png", "jpg", "jpeg", "pdf"];
  if (!validExtensions.includes(extension.toLowerCase())) {
    return {
      isValid: false,
      error: `Invalid file extension ".${extension}". Allowed: ${validExtensions.join(", ")}`,
    };
  }

  // Split by hyphen
  const parts = nameWithoutExt.split("-");

  // Must have at least 3 parts: classCode, studentCode, and description
  if (parts.length < 3) {
    return {
      isValid: false,
      error: `Filename "${filename}" does not match required format: {classCode}-{studentCode}-{description}.{ext}`,
    };
  }

  const fileClassCode = parts[0];
  const studentCode = parts[1];

  // Validate class code matches (case-sensitive)
  if (fileClassCode !== classCode) {
    return {
      isValid: false,
      error: `Class code "${fileClassCode}" does not match expected "${classCode}"`,
    };
  }

  // Validate student code is not empty
  if (!studentCode || studentCode.trim() === "") {
    return {
      isValid: false,
      error: `Student code is empty in filename "${filename}"`,
    };
  }

  // Validate description part exists (parts[2] onwards)
  const description = parts.slice(2).join("-");
  if (!description || description.trim() === "") {
    return {
      isValid: false,
      error: `Description is empty in filename "${filename}"`,
    };
  }

  return {
    isValid: true,
    studentCode: studentCode,
  };
}

/**
 * Validate multiple filenames at once
 * 
 * @param filenames - Array of filenames to validate
 * @param classCode - The expected class code
 * @returns Object with valid student codes and invalid filenames with errors
 */
export function validateFilenames(
  filenames: string[],
  classCode: string
): {
  validStudentCodes: string[];
  invalidFilenames: Array<{ filename: string; error: string }>;
} {
  const validStudentCodes: string[] = [];
  const invalidFilenames: Array<{ filename: string; error: string }> = [];

  for (const filename of filenames) {
    const result = parseStudentFilename(filename, classCode);
    if (result.isValid && result.studentCode) {
      validStudentCodes.push(result.studentCode);
    } else {
      invalidFilenames.push({
        filename,
        error: result.error || "Unknown error",
      });
    }
  }

  return {
    validStudentCodes,
    invalidFilenames,
  };
}

/**
 * Format error message for invalid filenames
 * 
 * @param invalidFilenames - Array of invalid filenames with errors
 * @param classCode - The expected class code
 * @returns Formatted error message
 */
export function formatFilenameErrors(
  invalidFilenames: Array<{ filename: string; error: string }>,
  classCode: string
): string {
  const errors = invalidFilenames
    .map((item) => `  - ${item.filename}: ${item.error}`)
    .join("\n");

  return `The following files do not match the required format ({classCode}-{studentCode}-{description}.{ext}):\n${errors}\n\nExpected class code: ${classCode}`;
}

