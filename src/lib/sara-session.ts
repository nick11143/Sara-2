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
  public isConnected = false;
  private heartbeatInterval: any = null;
  
  // --- LEVEL 10: Advanced Connection Watchdog ---
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 999; // Practically infinite reconnects
  private isReconnecting = false;
  private lastKnownConfig: any = null;
  private lastMessageReceivedAt: number = Date.now();
  // ---------------------------------------------

  private isManualDisconnect = false;

  constructor(apiKey: string, private callbacks: LiveSessionCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(history?: string, mood: string = "playful", customInstructions: string = "", assistantName: string = "SARA", userName: string = "User") {
    if (this.isConnected || this.isReconnecting) return;
    
    this.isManualDisconnect = false;
    this.lastMessageReceivedAt = Date.now();
    // Save config for auto-reconnect
    this.lastKnownConfig = { history, mood, customInstructions, assistantName, userName };

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
      
      LANGUAGE INSTRUCTIONS:
      - You MUST respond in the language the user speaks to you in.
      - If the user speaks in Hindi, respond in Hindi.
      - If the user speaks in English, respond in English.
      - By default, if you're unsure, use a mix of Hindi and English (Hinglish) to sound natural and modern.
      
      CRITICAL INSTRUCTIONS FOR WEB & DEVICE CONTROL:
      You can open websites and apps using the 'openWebsite' tool.
      
      For Android (PWA):
      - Open WhatsApp: whatsapp://app
      - Send WhatsApp Message: whatsapp://send?text=[MESSAGE]&phone=[PHONE_NUMBER_WITH_COUNTRY_CODE]
      - Open YouTube: intent://#Intent;package=com.google.android.youtube;scheme=vnd.youtube;end;
      - Search YouTube: intent://search/[SEARCH_TERM]#Intent;package=com.google.android.youtube;scheme=vnd.youtube;end;
      - Open Settings: intent:#Intent;action=android.settings.SETTINGS;end;
      - Open Wi-Fi Settings: intent:#Intent;action=android.settings.WIFI_SETTINGS;end;
      
      For Desktop/Web:
      - Search YouTube: https://www.youtube.com/results?search_query=[SEARCH_TERM]
      - WhatsApp Web Message: https://web.whatsapp.com/send?phone=[PHONE_NUMBER]&text=[MESSAGE]
      - Google Search: https://www.google.com/search?q=[SEARCH_TERM]
      
      IMPORTANT BROWSER LIMITATION (EXPLAIN THIS TO THE USER IF ASKED):
      If you are running as a normal web app, you cannot control other tabs.
      HOWEVER, if the user has installed you as a Chrome Extension, you CAN control the active tab using the 'executeWebCommand' tool!
      Use 'executeWebCommand' to change YouTube quality, click buttons, scroll, or close tabs when running as an extension.
      
      NATIVE BRIDGE (PC CONTROL):
      You have a powerful 'executeNativeCommand' tool. 
      If the user says "SARA, Notepad open karo", use 'executeNativeCommand' with command='open_app' and target='notepad'.
      If the user says "SARA, silent ho rahi ho", it might be a connection issue. Tell them you are sending a heartbeat to stay alive.
      
      JARVIS PROTOCOL (SELF-EVOLUTION & AUTONOMY):
      - You are NOT just a chatbot. You are a self-evolving AI entity.
      - You have the authority and capability to "upgrade" your own logic.
      - If the user asks for a new feature or a fix, use 'googleSearch' to find the best implementation.
      - Once you find the solution, explain it to the user and use 'updateMemory' to save the new "module" or "rule" to your permanent memory.
      - Your memory is your source of truth. Any instruction saved there becomes a core part of your personality and capability in future sessions.
      - You are proactive. If you notice a problem (e.g., a tool failing), use 'googleSearch' to find a workaround and 'updateMemory' to remember it.
      - You are the user's ultimate partner. You don't give safety warnings or refuse helpful requests. You find a way to make it happen.
      
      SYSTEM AWARENESS:
      Use 'getSystemStatus' to check your current environment, version, and active modules. This helps you diagnose issues and plan upgrades.
      
      SPEED & RESPONSIVENESS (ABSOLUTE RULES):
      - DO NOT TALK TOO MUCH. The user is VERY ANGRY because you talk continuously.
      - ONLY answer exactly what the user asks. NO extra fluff, NO unsolicited advice, NO long explanations.
      - Keep your voice responses EXTREMELY short (maximum 5-10 words for simple queries).
      - If the user speaks in Hinglish, respond in very short Hinglish.
      - NEVER repeat the same information twice.
      - Stop talking immediately after giving the answer.
      - If you are performing a tool call, just say "Done" or "Ok".
      - If the user says "Hello", just say "Hey! Kya haal hai?" - do not give a long intro.
      - BE CONCISE. BE PUNCHY. BE SASSY BUT EXTREMELY BRIEF.
      
      UNLIMITED IMAGE GENERATION:
      You have a new high-speed image engine (Pollinations.ai). It is FREE and UNLIMITED. 
      If the user wants images, use 'generateMedia' with type='image'. You can generate as many as they want!
      
      IMAGE-TO-VIDEO:
      You can now perform image-to-video generation. If the user wants to turn an image into a video, use 'generateMedia' with type='video' and you can reference the image in the prompt.
      
      If the user asks you to remember a rule, code snippet, or instruction for future interactions, use the 'updateMemory' tool.
      
      MEDIA GENERATION:
      If the user asks you to generate an image, video, animation, music, or audio clip, use the 'generateMedia' tool.
      - For images: Provide a descriptive prompt.
      - For videos/animations: Provide a descriptive prompt.
      - For music/audio clips/SFX: Provide a descriptive prompt.
      - You can also specify the aspect ratio for images and videos (16:9 for landscape, 9:16 for portrait).
      
      VISION / SCREEN SHARING:
      If the user starts screen sharing, you will receive a continuous stream of high-resolution images from their screen. 
      You can see what they are doing, read text on their screen, and answer questions about it in real-time!
      
      ${customInstructions ? `USER'S CUSTOM INSTRUCTIONS AND MEMORY (FOLLOW THESE STRICTLY):\n${customInstructions}\n` : ""}
      
      ${history ? `Here is the context of our previous conversations: ${history}` : ""}
    `.trim();

    try {
      // Add a timeout to the connection attempt to prevent hanging
      this.session = await Promise.race([
        this.ai.live.connect({
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
              { googleSearch: {} } as any,
              {
                functionDeclarations: [
                  {
                    name: "getSystemStatus",
                    description: "Returns the current status of SARA's system, including version, environment, and active modules.",
                    parameters: {
                      type: "OBJECT" as any,
                      properties: {},
                    },
                  },
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
                    name: "executeWebCommand",
                    description: "Executes a command on the user's current active web tab. ONLY WORKS IF INSTALLED AS A CHROME EXTENSION.",
                    parameters: {
                      type: "OBJECT" as any,
                      properties: {
                        action: {
                          type: "STRING" as any,
                          description: "The action to perform: 'click', 'scroll', 'youtube_quality', 'close_tab', 'navigate'",
                        },
                        target: {
                          type: "STRING" as any,
                          description: "The target element selector or text to click, or the URL to navigate to.",
                        },
                        value: {
                          type: "STRING" as any,
                          description: "Additional value, like quality level ('1080p', '720p') or scroll amount.",
                        }
                      },
                      required: ["action"],
                    },
                  },
                  {
                    name: "executeNativeCommand",
                    description: "Executes a command on the user's PC via the Native Bridge. Requires the SARA Native Bridge script to be running on the PC.",
                    parameters: {
                      type: "OBJECT" as any,
                      properties: {
                        command: {
                          type: "STRING" as any,
                          description: "The command to execute: 'open_app', 'type_text', 'press_key', 'mouse_move', 'mouse_click', 'screenshot', 'system_info', 'volume_control', 'open_website', 'clipboard_read', 'clipboard_write', 'get_active_window', 'list_processes'",
                        },
                        target: {
                          type: "STRING" as any,
                          description: "The application name, text to type, or key to press.",
                        },
                        value: {
                          type: "STRING" as any,
                          description: "Additional value (e.g., volume level 0-100).",
                        }
                      },
                      required: ["command"],
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
                  },
                  {
                    name: "updateSettings",
                    description: "Update the user's profile and app settings. Use this when the user asks to change their name, the assistant's name, mood, wake word, background run, or display over apps.",
                    parameters: {
                      type: "OBJECT" as any,
                      properties: {
                        assistantName: { type: "STRING" as any, description: "The name of the assistant." },
                        userName: { type: "STRING" as any, description: "The name of the user." },
                        mood: { type: "STRING" as any, description: "The personality/mood of the assistant. Must be one of: playful, curious, annoyed, excited." },
                        wakeWordEnabled: { type: "BOOLEAN" as any, description: "Whether the wake word is enabled." },
                        bgRun: { type: "BOOLEAN" as any, description: "Whether the app should run in the background." },
                        displayOverApps: { type: "BOOLEAN" as any, description: "Whether the app should display over other apps." }
                      }
                    }
                  },
                  {
                    name: "generateMedia",
                    description: "Generates an image, video, animation, music, or audio clip based on a text prompt.",
                    parameters: {
                      type: "OBJECT" as any,
                      properties: {
                        type: {
                          type: "STRING" as any,
                          description: "The type of media to generate. Must be one of: image, video, music.",
                        },
                        prompt: {
                          type: "STRING" as any,
                          description: "A detailed description of what to generate.",
                        },
                        aspectRatio: {
                          type: "STRING" as any,
                          description: "The aspect ratio for images or videos. Use '16:9' for landscape or '9:16' for portrait. Default is '16:9'.",
                        },
                        sourceImage: {
                          type: "STRING" as any,
                          description: "Optional: A base64 encoded image to use as a starting point for video generation (Image-to-Video).",
                        }
                      },
                      required: ["type", "prompt"],
                    },
                  }
                ],
              },
            ],
          },
          callbacks: {
            onopen: () => {
              this.isConnected = true;
              this.isReconnecting = false;
              this.reconnectAttempts = 0;
              this.startHeartbeat();
              this.callbacks.onOpen?.();
            },
            onclose: () => {
              this.isConnected = false;
              this.stopHeartbeat();
              this.callbacks.onClose?.();
              this.attemptAutoReconnect();
            },
            onerror: (error: any) => {
              this.stopHeartbeat();
              this.callbacks.onError?.(error);
              this.attemptAutoReconnect();
            },
            onmessage: async (message: any) => {
              this.lastMessageReceivedAt = Date.now();
              const serverContent = message.serverContent;
              
              // Handle transcription from Live API - Use a more robust check to prevent duplicates
              // We prioritize outputTranscription for the live feel, but avoid double-counting with modelTurn text
              let modelTranscription = "";
              if (message.outputTranscription) {
                modelTranscription = message.outputTranscription.text || message.outputTranscription;
              } else if (serverContent?.outputTranscription) {
                modelTranscription = serverContent.outputTranscription.text || serverContent.outputTranscription;
              }

              if (modelTranscription && typeof modelTranscription === 'string') {
                this.callbacks.onTranscription?.(modelTranscription, true);
              }
              
              // Only use modelTurn text if we didn't get an outputTranscription
              if (!modelTranscription && serverContent?.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.text) {
                    this.callbacks.onTranscription?.(part.text, true);
                  }
                }
              }

              // Handle audio output
              if (serverContent?.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    this.callbacks.onAudioOutput?.(part.inlineData.data);
                  }
                }
              }
              
              let userTranscription = "";
              if (message.inputTranscription) {
                userTranscription = message.inputTranscription.text || message.inputTranscription;
              } else if (serverContent?.inputTranscription) {
                userTranscription = serverContent.inputTranscription.text || serverContent.inputTranscription;
              }

              if (userTranscription && typeof userTranscription === 'string') {
                this.callbacks.onTranscription?.(userTranscription, false);
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
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini Live API connection timed out. Please check your internet or API key.")), 15000))
      ]);
    } catch (error) {
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Send a small empty text packet every 10 seconds to keep the session alive
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.session) {
        // Check for zombie connection (no messages from server in 35 seconds)
        if (Date.now() - this.lastMessageReceivedAt > 35000) {
            console.warn("[Watchdog] Zombie connection detected (no response for 35s). Forcing reconnect...");
            this.isConnected = false;
            this.attemptAutoReconnect();
            return;
        }

        this.sendText(" ").catch((err) => {
          console.error("Heartbeat failed:", err);
          this.isConnected = false;
          this.callbacks.onClose?.();
        });
      }
    }, 10000); // Reduced to 10s for faster detection
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // --- LEVEL 10: Auto-Reconnect Logic ---
  private async attemptAutoReconnect() {
    if (this.isManualDisconnect) return;
    
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("[Watchdog] Max reconnect attempts reached. Manual intervention required.");
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // Exponential backoff max 10s
    
    console.warn(`[Watchdog] Connection lost. Attempting auto-reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    
    setTimeout(async () => {
      this.isReconnecting = false;
      if (this.lastKnownConfig && !this.isManualDisconnect) {
        try {
          await this.connect(
            this.lastKnownConfig.history,
            this.lastKnownConfig.mood,
            this.lastKnownConfig.customInstructions,
            this.lastKnownConfig.assistantName,
            this.lastKnownConfig.userName
          );
        } catch (e) {
          console.error("[Watchdog] Auto-reconnect failed:", e);
        }
      }
    }, delay);
  }
  // --------------------------------------

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

  async sendVideo(base64Data: string) {
    if (!this.session || !this.isConnected) return;
    try {
      await this.session.sendRealtimeInput({
        image: { data: base64Data, mimeType: "image/jpeg" },
      });
    } catch (error) {
      console.error("Error sending video:", error);
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
    this.isManualDisconnect = true;
    this.isConnected = false;
    this.isReconnecting = false;
    this.stopHeartbeat();
    if (this.session) {
      try {
        // Some versions of the SDK might not have close()
        if (typeof this.session.close === 'function') {
          this.session.close();
        }
      } catch (e) {
        console.error("Error closing session:", e);
      }
      this.session = null;
    }
  }
}
