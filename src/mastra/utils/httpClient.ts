import axios, { AxiosInstance } from 'axios';

// Create HTTP client for file service requests
export const createFileServiceClient = (userToken?: string): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.FILE_SERVICE_URL || 'http://localhost:3001',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add user token to requests if provided
  if (userToken) {
    client.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
  }

  return client;
};
