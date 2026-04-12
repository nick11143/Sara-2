import axios from "axios";
import { encryptData, decryptData } from "./encryption";

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
}

export class GoogleDriveService {
  private static FILE_NAME = "SARA_Memory.json";

  static async getAuthUrl() {
    const response = await axios.get("/api/auth/google/url");
    return response.data.url;
  }

  static async refreshToken(refresh_token: string): Promise<GoogleTokens> {
    const response = await axios.post("/api/auth/google/refresh", { refresh_token });
    return response.data;
  }

  static async saveMemory(tokens: GoogleTokens, memory: any) {
    const { access_token } = tokens;

    try {
      // 1. Search for the file in appDataFolder
      const searchResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files?q=name='${this.FILE_NAME}' and trashed=false&spaces=appDataFolder`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      const files = searchResponse.data.files;
      let fileId = files.length > 0 ? files[0].id : null;

      if (fileId) {
        // 2. Update existing file
        const encryptedPayload = { encryptedData: encryptData(memory) };
        await axios.patch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          JSON.stringify(encryptedPayload),
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        // 3. Create new file in appDataFolder
        const metadata = {
          name: this.FILE_NAME,
          mimeType: "application/json",
          parents: ["appDataFolder"],
        };

        const createResponse = await axios.post(
          "https://www.googleapis.com/drive/v3/files",
          metadata,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        fileId = createResponse.data.id;

        // Upload content
        const encryptedPayload = { encryptedData: encryptData(memory) };
        await axios.patch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          JSON.stringify(encryptedPayload),
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return true;
    } catch (error: any) {
      console.error("Error saving to Google Drive:", error.response?.data || error.message);
      throw error;
    }
  }

  static async loadMemory(tokens: GoogleTokens) {
    const { access_token } = tokens;

    try {
      const searchResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files?q=name='${this.FILE_NAME}' and trashed=false&spaces=appDataFolder`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      const files = searchResponse.data.files;
      if (files.length === 0) return null;

      const fileId = files[0].id;
      const contentResponse = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      const data = contentResponse.data;
      if (data && data.encryptedData) {
        return decryptData(data.encryptedData);
      }
      
      // Fallback for old unencrypted data
      return data;
    } catch (error: any) {
      console.error("Error loading from Google Drive:", error.response?.data || error.message);
      return null;
    }
  }
}
