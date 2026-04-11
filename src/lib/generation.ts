import { GoogleGenAI, Modality } from "@google/genai";

// --- LEVEL 10: Advanced Retry & Security Wrapper ---
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`[Generation Engine] Attempt ${i + 1} failed. Retrying in ${delayMs}ms...`, error);
      lastError = error;
      await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw new Error(`[Generation Engine] Critical Failure after ${maxRetries} attempts: ${lastError?.message}`);
}

function sanitizeInput(input: string): string {
  // Basic sanitization to prevent injection or malformed URLs
  return input.replace(/[<>]/g, '').trim();
}
// ---------------------------------------------------

export class GenerationService {
  private ai: GoogleGenAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates an image from a text prompt using Pollinations.ai (Free & Unlimited).
   */
  async generateImage(prompt: string, aspectRatio: string = "1:1") {
    return withRetry(async () => {
      try {
        const safePrompt = sanitizeInput(prompt);
        const seed = Math.floor(Math.random() * 1000000);
        let width = 1024;
        let height = 1024;

        if (aspectRatio === "16:9") {
          width = 1280;
          height = 720;
        } else if (aspectRatio === "9:16") {
          width = 720;
          height = 1280;
        }

        const encodedPrompt = encodeURIComponent(safePrompt);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
        
        return url;
      } catch (err) {
        console.error("Pollinations failed, falling back to Gemini:", err);
        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
            }
          }
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
        throw new Error("Failed to generate image");
      }
    });
  }

  /**
   * Generates a video from a prompt and optional starting image.
   */
  async generateVideo(prompt: string, base64Image?: string, aspectRatio: string = "16:9") {
    const config: any = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: aspectRatio,
    };

    const payload: any = {
      model: "veo-3.1-lite-generate-preview",
      prompt,
      config,
    };

    if (base64Image) {
      // Extract mime type and data from data URL
      const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        payload.image = {
          imageBytes: matches[2],
          mimeType: matches[1],
        };
      }
    }

    let operation = await this.ai.models.generateVideos(payload);

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await this.ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Failed to generate video");

    // Fetch the video using the API key
    const response = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': this.apiKey,
      },
    });

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  /**
   * Generates a 30-second music clip.
   */
  async generateMusic(prompt: string) {
    const response = await this.ai.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: prompt,
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
      }
    }

    if (!audioBase64) throw new Error("Failed to generate music");

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  }
}
