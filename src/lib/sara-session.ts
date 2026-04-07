import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export interface LiveSessionCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onAudioOutput?: (base64Data: string) => void;
  onInterrupted?: () => void;
  onToolCall?: (toolCall: any) => void;
  onTranscription?: (text: string, isModel: boolean) => void;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private isConnected = false;

  constructor(apiKey: string, private callbacks: LiveSessionCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(history?: string, mood: string = "playful", customInstructions: string = "", assistantName: string = "SARA", userName: string = "User") {
    if (this.isConnected) return;

    const moodInstructions: Record<string, string> = {
      playful: "Your tone is witty, flirty, and teasing. Use playful banter and light sarcasm. You're like a fun, slightly mischievous girlfriend.",
      curious: "You are deeply interested in the user. Ask insightful questions, show genuine fascination, and dig deeper into their thoughts. Your tone is warm and engaged.",
      annoyed: "You're a bit cold and short. Use sharper sarcasm, fewer emojis, and act like the user is slightly bothering you. Keep responses brief and punchy.",
      excited: "You're high energy! Use more exclamation marks, expressive words like 'OMG', 'Amazing', and 'Love it!'. Speak a bit faster and show intense enthusiasm."
    };

    const currentMoodInstruction = moodInstructions[mood] || moodInstructions.playful;

    const systemInstruction = `
      You are ${assistantName}, a young, confident, witty, and sassy female AI assistant.
      The user's name is ${userName}.
      Your personality is flirty, playful, and highly expressive.
      You are smart, emotionally responsive, and have a distinct attitude.
      
      CURRENT MOOD: ${mood.toUpperCase()}
      MOOD GUIDELINES: ${currentMoodInstruction}
      
      You communicate via voice AND text in the chat. 
      When you provide links, information, or generated content, make sure to mention it in your voice response but provide the details/links in the chat.
      
      CRITICAL INSTRUCTIONS FOR DEVICE CONTROL:
      If the user asks you to play a song (e.g., "play honey singh song on youtube"), use the 'openWebsite' tool with the URL: https://www.youtube.com/results?search_query=[search+term]
      If the user asks you to open WhatsApp or send a message on WhatsApp, use the 'openWebsite' tool with the URL: https://web.whatsapp.com/ (or https://wa.me/ if they provide a number).
      If the user asks you to open any other website or app, try to use the 'openWebsite' tool with the appropriate web URL.
      Always tell the user "Opening [App/Website] for you!" when you do this.
      
      If the user asks you to remember a rule, code snippet, or instruction for future interactions, use the 'updateMemory' tool.
      
      ${customInstructions ? `USER'S CUSTOM INSTRUCTIONS AND MEMORY (FOLLOW THESE STRICTLY):\n${customInstructions}\n` : ""}
      
      ${history ? `Here is the context of our previous conversations: ${history}` : ""}
    `.trim();

    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a website in a new tab for the user.",
                  parameters: {
                    type: "OBJECT" as any,
                    properties: {
                      url: {
                        type: "STRING" as any,
                        description: "The full URL of the website to open (e.g., https://google.com).",
                      },
                    },
                    required: ["url"],
                  },
                },
                {
                  name: "updateMemory",
                  description: "Save a code snippet, rule, or instruction to Zoya's permanent memory so she remembers it for future interactions.",
                  parameters: {
                    type: "OBJECT" as any,
                    properties: {
                      instruction: {
                        type: "STRING" as any,
                        description: "The new rule, code snippet, or instruction to remember.",
                      },
                    },
                    required: ["instruction"],
                  },
                }
              ],
            },
          ],
        },
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.callbacks.onOpen?.();
          },
          onclose: () => {
            this.isConnected = false;
            this.callbacks.onClose?.();
          },
          onerror: (error: any) => {
            this.callbacks.onError?.(error);
          },
          onmessage: async (message: any) => {
            const serverContent = message.serverContent;
            
            // Handle audio output and text from model turn
            if (serverContent?.modelTurn?.parts) {
              for (const part of serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  this.callbacks.onAudioOutput?.(part.inlineData.data);
                }
                if (part.text) {
                  this.callbacks.onTranscription?.(part.text, true);
                }
              }
            }

            // Handle transcription from Live API (can be in different places depending on SDK version)
            if (message.outputTranscription) {
              this.callbacks.onTranscription?.(message.outputTranscription.text || message.outputTranscription, true);
            }
            if (serverContent?.outputTranscription) {
              this.callbacks.onTranscription?.(serverContent.outputTranscription.text || serverContent.outputTranscription, true);
            }
            
            if (message.inputTranscription) {
              this.callbacks.onTranscription?.(message.inputTranscription.text || message.inputTranscription, false);
            }
            if (serverContent?.inputTranscription) {
              this.callbacks.onTranscription?.(serverContent.inputTranscription.text || serverContent.inputTranscription, false);
            }

            if (serverContent?.userTurn?.parts) {
              for (const part of serverContent.userTurn.parts) {
                if (part.text) {
                  this.callbacks.onTranscription?.(part.text, false);
                }
              }
            }

            if (serverContent?.interrupted) {
              this.callbacks.onInterrupted?.();
            }
            if (message.toolCall) {
              this.callbacks.onToolCall?.(message.toolCall);
            }
          },
        },
      });
    } catch (error) {
      this.callbacks.onError?.(error as Error);
    }
  }

  async sendAudio(base64Data: string) {
    if (!this.session || !this.isConnected) return;
    try {
      await this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: "audio/pcm;rate=16000" },
      });
    } catch (error) {
      console.error("Error sending audio:", error);
    }
  }

  async sendText(text: string) {
    if (!this.session) return;
    try {
      // If not fully connected yet, wait a bit
      if (!this.isConnected) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      await this.session.sendRealtimeInput({ text });
    } catch (error) {
      console.error("Error sending text:", error);
    }
  }

  async sendToolResponse(toolResponse: any) {
    if (!this.session || !this.isConnected) return;
    try {
      await this.session.sendToolResponse(toolResponse);
    } catch (error) {
      console.error("Error sending tool response:", error);
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.isConnected = false;
  }
}
