import { createFileServiceClient } from "./httpClient";

export interface AuthenticatedImageData {
  buffer: Buffer;
  mimeType: string;
}

export const fetchAuthenticatedImage = async (
  imageUrl: string,
  userToken?: string
): Promise<AuthenticatedImageData> => {
  try {
    // Parse the URL to extract file ID
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split("/");
    const fileId = pathParts[pathParts.length - 2]; // Extract fileId from /files/{fileId}/render

    if (!fileId) {
      throw new Error("Invalid file URL format");
    }

    // Create authenticated client
    const fileClient = createFileServiceClient(userToken);

    // Make authenticated request to file service
    const response = await fileClient.get(`/api/files/${fileId}/render`, {
      responseType: "arraybuffer",
    });

    return {
      buffer: Buffer.from(response.data),
      mimeType: response.headers["content-type"] || "image/png",
    };
  } catch (error: any) {
    console.error("Error fetching authenticated image:", error);
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
};
