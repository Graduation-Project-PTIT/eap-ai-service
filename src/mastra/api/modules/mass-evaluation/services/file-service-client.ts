import axios, { AxiosInstance } from "axios";

/**
 * File metadata interface based on file service response
 */
export interface FileMetadata {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * HTTP client for eap-file-service
 * Handles communication with the file service to retrieve file metadata
 */
class FileServiceClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.FILE_SERVICE_URL || "http://localhost:3001";
    this.client = axios.create({
      baseURL: `${this.baseURL}/api`,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get file metadata by file ID
   * Note: The file service doesn't have a dedicated GET /files/:id endpoint,
   * so we'll use the GET /files endpoint and filter by ID
   * 
   * @param fileId - The UUID of the file
   * @param userToken - JWT token for authentication
   * @returns File metadata including originalName
   */
  async getFileById(
    fileId: string,
    userToken: string
  ): Promise<FileMetadata | null> {
    try {
      // Get all files for the user
      const response = await this.client.get<{ files: FileMetadata[] }>(
        "/files",
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      // Find the file by ID
      const file = response.data.files.find((f) => f.id === fileId);
      return file || null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `File service error: ${error.response?.status} - ${error.message}`
        );
        if (error.response?.status === 404) {
          return null;
        }
        throw new Error(
          `Failed to fetch file metadata: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get multiple files by their IDs
   * More efficient than calling getFileById multiple times
   * 
   * @param fileIds - Array of file UUIDs
   * @param userToken - JWT token for authentication
   * @returns Map of fileId -> FileMetadata
   */
  async getFilesByIds(
    fileIds: string[],
    userToken: string
  ): Promise<Map<string, FileMetadata>> {
    try {
      // Get all files for the user
      const response = await this.client.get<{ files: FileMetadata[] }>(
        "/files",
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      // Create a map of fileId -> FileMetadata for the requested files
      const fileMap = new Map<string, FileMetadata>();
      const fileIdSet = new Set(fileIds);

      response.data.files.forEach((file) => {
        if (fileIdSet.has(file.id)) {
          fileMap.set(file.id, file);
        }
      });

      return fileMap;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `File service error: ${error.response?.status} - ${error.message}`
        );
        throw new Error(
          `Failed to fetch file metadata: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Check if the file service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error("File service health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const fileServiceClient = new FileServiceClient();

