import axios, { AxiosInstance } from "axios";

/**
 * Student interface based on class service response
 */
export interface Student {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Class interface based on class service response
 */
export interface ClassInfo {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  students: Student[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Class service response wrapper
 */
interface ClassServiceResponse<T> {
  data: T;
  total?: number;
  meta?: any;
}

/**
 * HTTP client for eap-class-service
 * Handles communication with the class service for class and student validation
 */
class ClassServiceClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.CLASS_SERVICE_URL || "";
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/class-service`,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get class by ID with student information
   *
   * @param classId - The UUID of the class
   * @param userToken - JWT token for authentication
   * @returns Class information including students
   */
  async getClassById(
    classId: string,
    userToken: string
  ): Promise<ClassInfo | null> {
    try {
      const response = await this.client.get<ClassServiceResponse<ClassInfo>>(
        `/classes/${classId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Class service error: ${error.response?.status} - ${error.message}`
        );
        if (error.response?.status === 404) {
          return null;
        }
        throw new Error(
          `Failed to fetch class: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate that all student codes exist in the specified class
   * Returns a list of invalid student codes (codes that don't exist in the class)
   *
   * @param classId - The UUID of the class
   * @param studentCodes - Array of student codes to validate
   * @param userToken - JWT token for authentication
   * @returns Array of invalid student codes with their names (if available)
   */
  async validateStudentsInClass(
    classId: string,
    studentCodes: string[],
    userToken: string
  ): Promise<string[]> {
    try {
      // Get class with students
      const classInfo = await this.getClassById(classId, userToken);

      if (!classInfo) {
        throw new Error(`Class with ID ${classId} not found`);
      }

      // Get only active students
      const activeStudents = classInfo.students.filter((s) => s.isActive);

      // Create a set of valid student codes for efficient lookup
      const validStudentCodes = new Set(activeStudents.map((s) => s.code));

      // Find invalid student codes
      const invalidStudents: string[] = [];
      for (const studentCode of studentCodes) {
        if (!validStudentCodes.has(studentCode)) {
          invalidStudents.push(studentCode);
        }
      }

      return invalidStudents;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Class service error: ${error.response?.status} - ${error.message}`
        );
        throw new Error(
          `Failed to validate students: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Check if the class service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error("Class service health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const classServiceClient = new ClassServiceClient();
