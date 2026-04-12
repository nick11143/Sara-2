import CryptoJS from 'crypto-js';

// In a real production app, this key should be securely derived from user credentials.
// For this hybrid local/drive approach, we use a static app key to ensure data 
// is encrypted at rest in both local storage and Google Drive.
const SECRET_KEY = process.env.VITE_ENCRYPTION_KEY || 'sara-quantum-encryption-key-2026';

export const encryptData = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
};

export const decryptData = (encryptedData: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error("Decryption resulted in empty string (wrong key?)");
    }
    
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error("Decryption failed:", error);
    // Return null to indicate decryption failure rather than crashing
    return null;
  }
};
