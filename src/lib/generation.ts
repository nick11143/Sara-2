import { GoogleGenAI, Modality } from "@google/genai";

export class GenerationService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates an image from a text prompt.
   */
  async generateImage(prompt: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
    throw new Error("Failed to generate image");
  }

  /**
   * Generates a video from a prompt and optional starting image.
   */
  async generateVideo(prompt: string, base64Image?: string) {
    const config: any = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: "16:9",
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
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
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
