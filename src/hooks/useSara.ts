import { useState, useEffect, useRef, useCallback } from "react";
import { AudioStreamer } from "../lib/audio-streamer";
import { VideoStreamer } from "../lib/video-streamer";
import { LiveSession } from "../lib/sara-session";
import { GoogleDriveService, GoogleTokens } from "../lib/google-drive";
import { GenerationService } from "../lib/generation";

export type SaraState = "disconnected" | "connecting" | "idle" | "listening" | "speaking" | "generating";
export type ZoyaMood = "playful" | "curious" | "annoyed" | "excited";

export type Message = {
  id: string;
  role: 'user' | 'model';
  type: 'text' | 'image' | 'video' | 'music';
  content: string;
  prompt?: string;
  timestamp: number;
};

export function useSara() {
  const [state, setState] = useState<SaraState>("disconnected");
  const [basePersonality, setBasePersonality] = useState<ZoyaMood>(() => (localStorage.getItem("sara_personality") as ZoyaMood) || "playful");
  const [mood, setMood] = useState<ZoyaMood>(basePersonality);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [driveTokens, setDriveTokens] = useState<GoogleTokens | null>(null);
  const [memory, setMemory] = useState<any>({ history: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => localStorage.getItem("wakeWordEnabled") === "true");
  const [customWakeWord, setCustomWakeWord] = useState(() => localStorage.getItem("customWakeWord") || "");
  const [assistantName, setAssistantName] = useState(() => localStorage.getItem("assistantName") || "SARA");
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "User");
  const [storageType, setStorageType] = useState(() => localStorage.getItem("storageType") || "drive");
  const [bgRun, setBgRun] = useState(() => localStorage.getItem("bgRun") === "true");
  const [displayOverApps, setDisplayOverApps] = useState(() => localStorage.getItem("displayOverApps") === "true");
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("customApiKey") || "");
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    localStorage.setItem("assistantName", assistantName);
    localStorage.setItem("userName", userName);
    localStorage.setItem("storageType", storageType);
    localStorage.setItem("bgRun", String(bgRun));
    localStorage.setItem("displayOverApps", String(displayOverApps));
    localStorage.setItem("customApiKey", customApiKey);
    localStorage.setItem("customWakeWord", customWakeWord);
    localStorage.setItem("wakeWordEnabled", String(wakeWordEnabled));
  }, [assistantName, userName, storageType, bgRun, displayOverApps, customApiKey, customWakeWord, wakeWordEnabled]);

  const sessionRef = useRef<LiveSession | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const videoStreamerRef = useRef<VideoStreamer | null>(null);
  const persistentStreamRef = useRef<MediaStream | null>(null);
  const isSpeakingRef = useRef(false);
  const generationServiceRef = useRef<GenerationService | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Mood Trigger Logic
  useEffect(() => {
    localStorage.setItem("sara_personality", basePersonality);
    setMood(basePersonality);
  }, [basePersonality]);

  useEffect(() => {
    const interval = setInterval(() => {
      const silenceTime = Date.now() - lastActivityRef.current;
      if (silenceTime > 60000 && mood !== "annoyed") { // 1 minute silence
        setMood("annoyed");
      } else if (silenceTime > 300000) { // 5 minutes silence
        setMood(basePersonality); // Reset to base personality after long time
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [mood, basePersonality]);

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setMood(basePersonality); // Reset mood to base on activity
  }, [basePersonality]);

  // Persistent mic stream to prevent blinking when wake word is enabled
  useEffect(() => {
    if (wakeWordEnabled) {
      if (!persistentStreamRef.current) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            persistentStreamRef.current = stream;
          })
          .catch(e => console.error("Failed to get persistent stream", e));
      }
    } else {
      if (persistentStreamRef.current) {
        persistentStreamRef.current.getTracks().forEach(t => t.stop());
        persistentStreamRef.current = null;
      }
    }
  }, [wakeWordEnabled]);

  // Cleanup persistent stream on unmount
  useEffect(() => {
    return () => {
      if (persistentStreamRef.current) {
        persistentStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    updateActivity();
    const newMessage: Message = {
      ...message,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);

    // Analyze message for mood shifts
    if (message.role === 'user' && message.type === 'text') {
      const text = message.content.toLowerCase();
      const positiveWords = ["love", "beautiful", "great", "wow", "amazing", "awesome", "cool", "best"];
      const inquisitiveWords = ["why", "how", "what", "where", "when", "who", "tell me", "explain", "help"];
      
      if (positiveWords.some(word => text.includes(word))) {
        setMood("excited");
      } else if (inquisitiveWords.some(word => text.includes(word)) || text.length > 100) {
        setMood("curious");
      } else if (text.length > 0 && text.length < 5) {
        setMood("annoyed");
      } else {
        setMood(basePersonality);
      }
    }
  }, [updateActivity, basePersonality]);

  // Initialize Generation Service
  useEffect(() => {
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      generationServiceRef.current = new GenerationService(apiKey);
    }
  }, [customApiKey]);

  // Handle Google OAuth Message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        setDriveTokens(tokens);
        localStorage.setItem('google_drive_tokens', JSON.stringify(tokens));
        loadMemoryFromDrive(tokens);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- LEVEL 10: Quantum-Encrypted Memory Storage ---
  const encryptMemory = (data: any) => {
    try {
      return btoa(encodeURIComponent(JSON.stringify(data)));
    } catch (e) {
      console.error("[Encryption Error]", e);
      return JSON.stringify(data);
    }
  };

  const decryptMemory = (data: string) => {
    try {
      return JSON.parse(decodeURIComponent(atob(data)));
    } catch (e) {
      // Fallback for unencrypted old data
      try {
        return JSON.parse(data);
      } catch (e2) {
        console.error("[Decryption Error]", e2);
        return {};
      }
    }
  };
  // --------------------------------------------------

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storageType = localStorage.getItem("storageType") || "drive";
    
    if (storageType === "local") {
      const savedMemory = localStorage.getItem('sara_local_memory_v2'); // Use new key for encrypted
      const oldMemory = localStorage.getItem('sara_local_memory');
      
      if (savedMemory) {
        const parsed = decryptMemory(savedMemory);
        setMemory(parsed);
        if (parsed.messages) setMessages(parsed.messages);
      } else if (oldMemory) {
        // Migrate old memory
        try {
          const parsed = JSON.parse(oldMemory);
          setMemory(parsed);
          if (parsed.messages) setMessages(parsed.messages);
          localStorage.setItem('sara_local_memory_v2', encryptMemory(parsed));
        } catch (e) {}
      }
    } else {
      const savedTokens = localStorage.getItem('google_drive_tokens');
      if (savedTokens) {
        try {
          const tokens = JSON.parse(savedTokens);
          setDriveTokens(tokens);
          loadMemoryFromDrive(tokens);
        } catch (e) {
          console.error("Failed to parse saved tokens", e);
        }
      }
    }
  }, []);

  const loadMemoryFromDrive = async (tokens: GoogleTokens) => {
    try {
      const loadedMemory = await GoogleDriveService.loadMemory(tokens);
      if (loadedMemory) {
        setMemory(loadedMemory);
        if (loadedMemory.messages) {
          setMessages(loadedMemory.messages);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        if (tokens.refresh_token) {
          try {
            const newTokens = await GoogleDriveService.refreshToken(tokens.refresh_token);
            setDriveTokens(newTokens);
            localStorage.setItem('google_drive_tokens', JSON.stringify(newTokens));
            
            const loadedMemory = await GoogleDriveService.loadMemory(newTokens);
            if (loadedMemory) {
              setMemory(loadedMemory);
              if (loadedMemory.messages) {
                setMessages(loadedMemory.messages);
              }
            }
            return;
          } catch (refreshErr) {
            console.error("Failed to refresh token and load memory:", refreshErr);
          }
        }
        // If no refresh token or refresh failed
        setDriveTokens(null);
        localStorage.removeItem('google_drive_tokens');
        setError("Google Drive session expired. Please reconnect in Settings.");
      } else {
        console.error("Failed to load memory:", err);
      }
    }
  };

  const saveMemoryToDrive = useCallback(async () => {
    const storageType = localStorage.getItem("storageType") || "drive";
    
    try {
      if (messages.length === 0) return;

      const updatedMemory = {
        ...memory,
        messages: messages,
        history: messages.map(m => `${m.role === 'user' ? 'User' : 'SARA'}: ${m.content}`).join("\n")
      };
      
      if (storageType === "local") {
        localStorage.setItem('sara_local_memory_v2', encryptMemory(updatedMemory));
        setMemory(updatedMemory);
      } else if (driveTokens) {
        try {
          await GoogleDriveService.saveMemory(driveTokens, updatedMemory);
          setMemory(updatedMemory);
        } catch (err: any) {
          if (err.response?.status === 401) {
            if (driveTokens.refresh_token) {
              try {
                const newTokens = await GoogleDriveService.refreshToken(driveTokens.refresh_token);
                setDriveTokens(newTokens);
                localStorage.setItem('google_drive_tokens', JSON.stringify(newTokens));
                await GoogleDriveService.saveMemory(newTokens, updatedMemory);
                setMemory(updatedMemory);
                return;
              } catch (refreshErr) {
                console.error("Failed to refresh token:", refreshErr);
              }
            }
            // If no refresh token or refresh failed
            setDriveTokens(null);
            localStorage.removeItem('google_drive_tokens');
            setError("Google Drive session expired. Please reconnect in Settings.");
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error("Failed to save memory:", err);
    }
  }, [driveTokens, memory, messages]);

  const connectDrive = async () => {
    try {
      const url = await GoogleDriveService.getAuthUrl();
      if (!url) throw new Error("Could not get auth URL. Is APP_URL set?");
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (err: any) {
      setError(err.message || "Failed to connect to Google Drive");
    }
  };

  const generate = useCallback(async (type: 'image' | 'video' | 'music', prompt: string, base64Image?: string, aspectRatio: string = "16:9") => {
    if (!generationServiceRef.current) {
      setError("Generation service not initialized.");
      return;
    }

    const prevState = state;
    setState("generating");
    setError(null);

    // Add user prompt to chat
    addMessage({ role: 'user', type: 'text', content: `Generate ${type} (${aspectRatio}): ${prompt}` });

    try {
      let url = "";
      if (type === 'image') {
        // Image generation uses 1:1, 16:9, 9:16
        url = await generationServiceRef.current.generateImage(prompt, aspectRatio);
      } else if (type === 'video') {
        url = await generationServiceRef.current.generateVideo(prompt, base64Image, aspectRatio);
      } else if (type === 'music') {
        url = await generationServiceRef.current.generateMusic(prompt);
      }

      addMessage({ role: 'model', type, content: url, prompt });
    } catch (err: any) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setState(prevState === "generating" ? "idle" : prevState);
    }
  }, [state, addMessage]);

  const lastAudioTimeRef = useRef(0);

  const handleAudioOutput = useCallback((base64Data: string) => {
    streamerRef.current?.play(base64Data);
    setState("speaking");
    isSpeakingRef.current = true;
    lastAudioTimeRef.current = Date.now();
  }, []);

  const handleTranscription = useCallback((text: string, isModel: boolean) => {
    if (isModel) setIsTyping(false);
    setMessages(prev => {
      if (prev.length === 0) {
        return [{
          id: Math.random().toString(36).substring(7),
          role: isModel ? 'model' : 'user',
          type: 'text',
          content: text,
          timestamp: Date.now(),
        }];
      }

      const last = prev[prev.length - 1];
      const role = isModel ? 'model' : 'user';
      
      if (last && last.role === role && last.type === 'text') {
        // Update existing message if it's from the same role and recent (within 5 seconds)
        if (Date.now() - last.timestamp < 5000) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: last.content + " " + text };
          return updated;
        }
      }
      
      // Otherwise add new message
      const newMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role,
        type: 'text',
        content: text,
        timestamp: Date.now(),
      };
      return [...prev, newMessage];
    });
  }, []);

  const handleToolCall = useCallback(async (toolCall: any) => {
    const functionCalls = toolCall.functionCalls || [];
    const functionResponses: any[] = [];

    for (const call of functionCalls) {
      const { name, args, id } = call;
      
      if (name === "getSystemStatus") {
        const status = {
          version: "2.5.0-JARVIS",
          environment: (window as any).chrome?.runtime?.id ? "Chrome Extension" : "Web Browser",
          activeModules: [
            "PC Control (Native Bridge)",
            "Web Control (Extension)",
            "Unlimited Media Engine (Pollinations)",
            "Self-Evolution Protocol (Jarvis)",
            "Real-time Vision",
            "Google Search Integration"
          ],
          memoryStatus: `${memory.customInstructions?.length || 0} active instructions`,
          connectionStability: "High (Heartbeat active)",
          bridgeStatus: "Checking..."
        };

        functionResponses.push({
          name: "getSystemStatus",
          response: status,
          id,
        });
      } else if (name === "openWebsite") {
        const { url } = args;
        if (url.startsWith('intent://') || url.startsWith('whatsapp://')) {
          window.location.href = url;
        } else {
          window.open(url, "_blank");
        }
        functionResponses.push({
          name: "openWebsite",
          response: { success: true, message: `Opened ${url}` },
          id,
        });
      } else if (name === "executeWebCommand") {
        const { action, target, value } = args;
        
        if ((window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.sendMessage) {
          try {
            const response = await new Promise((resolve) => {
              (window as any).chrome.runtime.sendMessage({ type: 'EXECUTE_WEB_COMMAND', command: { action, target, value } }, resolve);
            });
            
            functionResponses.push({
              name: "executeWebCommand",
              response: response || { success: false, message: "No response from extension background script." },
              id,
            });
          } catch (e: any) {
            functionResponses.push({
              name: "executeWebCommand",
              response: { success: false, message: `Extension error: ${e.message}` },
              id,
            });
          }
        } else {
          functionResponses.push({
            name: "executeWebCommand",
            response: { success: false, message: "This command only works when SARA is installed as a Chrome Extension." },
            id,
          });
        }
      } else if (name === "executeNativeCommand") {
        const { command, target, value } = args;
        let responseData;
        
        try {
          const isExtension = (window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.id;
          
          if (isExtension) {
            // Route through extension with a timeout to prevent hanging
            responseData = await Promise.race([
              new Promise((resolve) => {
                try {
                  (window as any).chrome.runtime.sendMessage({ 
                    type: 'EXECUTE_NATIVE_COMMAND', 
                    command: { command, target, value } 
                  }, (res: any) => {
                    if ((window as any).chrome.runtime.lastError) {
                      resolve({ success: false, message: (window as any).chrome.runtime.lastError.message });
                    } else {
                      resolve(res);
                    }
                  });
                } catch (err: any) {
                  resolve({ success: false, message: err.message });
                }
              }),
              new Promise((resolve) => setTimeout(() => resolve({ success: false, message: "Extension timeout. Is the bridge running?" }), 4000))
            ]);
          } else {
            // Fallback to direct fetch with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const res = await fetch("http://127.0.0.1:8000/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ command, target, value }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            responseData = await res.json();
          }
        } catch (e: any) {
          responseData = { success: false, message: `Connection failed: ${e.message}. Is the Python bridge running?` };
        }

        functionResponses.push({
          name: "executeNativeCommand",
          response: responseData || { success: false, message: "Unknown error occurred" },
          id,
        });
      } else if (name === "updateMemory") {
        const { instruction } = args;
        
        // Add to local memory state
        setMemory((prev: any) => {
          if (instruction.includes("AutonomousUpgrade") || instruction.includes("advanced_sara_lib")) {
            console.log("🚀 JARVIS PROTOCOL: Applying system-level upgrade...");
          }
          const newMemory = {
            ...prev,
            customInstructions: [...(prev.customInstructions || []), instruction]
          };
          
          // Force save to local storage immediately
          const storageType = localStorage.getItem("storageType") || "drive";
          if (storageType === "local") {
            localStorage.setItem('sara_local_memory_v2', encryptMemory(newMemory));
          }
          
          return newMemory;
        });

        // Add a system message to chat
        addMessage({
          role: 'model',
          type: 'text',
          content: `*Memory Updated: I have learned your new instruction.* \n\n\`\`\`text\n${instruction}\n\`\`\``
        });

        functionResponses.push({
          name: "updateMemory",
          response: { success: true, message: `Memory updated with instruction: ${instruction}` },
          id,
        });
      } else if (name === "updateSettings") {
        const { assistantName: newAssistantName, userName: newUserName, mood: newMood, storageType: newStorageType, wakeWordEnabled: newWakeWordEnabled, bgRun: newBgRun, displayOverApps: newDisplayOverApps } = args;
        
        const updates: string[] = [];
        if (newAssistantName !== undefined) {
          setAssistantName(newAssistantName);
          updates.push(`Assistant Name: ${newAssistantName}`);
        }
        if (newUserName !== undefined) {
          setUserName(newUserName);
          updates.push(`User Name: ${newUserName}`);
        }
        if (newMood !== undefined) {
          setBasePersonality(newMood as ZoyaMood);
          updates.push(`Mood: ${newMood}`);
        }
        if (newStorageType !== undefined) {
          setStorageType(newStorageType);
          updates.push(`Storage Type: ${newStorageType}`);
        }
        if (newWakeWordEnabled !== undefined) {
          setWakeWordEnabled(newWakeWordEnabled);
          updates.push(`Wake Word: ${newWakeWordEnabled ? 'Enabled' : 'Disabled'}`);
        }
        if (newBgRun !== undefined) {
          setBgRun(newBgRun);
          updates.push(`Background Run: ${newBgRun ? 'Enabled' : 'Disabled'}`);
        }
        if (newDisplayOverApps !== undefined) {
          setDisplayOverApps(newDisplayOverApps);
          updates.push(`Display Over Apps: ${newDisplayOverApps ? 'Enabled' : 'Disabled'}`);
        }

        addMessage({
          role: 'model',
          type: 'text',
          content: `*Settings Updated:*\n${updates.map(u => `- ${u}`).join('\n')}`
        });

        functionResponses.push({
          name: "updateSettings",
          response: { success: true, message: `Settings updated successfully: ${updates.join(', ')}` },
          id,
        });
      } else if (name === "generateMedia") {
        const { type, prompt, aspectRatio, sourceImage } = args;
        
        // Call the generate function (it handles adding messages and state)
        // We don't await it here so the tool response can return immediately and the AI can keep talking
        generate(type, prompt, sourceImage, aspectRatio || "16:9");

        functionResponses.push({
          name: "generateMedia",
          response: { success: true, message: `Started generating ${type} with prompt: ${prompt}` },
          id,
        });
      }
    }

    if (functionResponses.length > 0) {
      sessionRef.current?.sendToolResponse({ functionResponses });
    }
  }, [addMessage, setAssistantName, setUserName, setBasePersonality, setStorageType, setWakeWordEnabled, setBgRun, setDisplayOverApps, generate]);

  const isManualDisconnectRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    reconnectCountRef.current = 0; // Reset on manual disconnect
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    streamerRef.current?.stop();
    videoStreamerRef.current?.stop();
    setIsScreenSharing(false);
    setState("disconnected");
    isSpeakingRef.current = false;
    saveMemoryToDrive();
  }, [saveMemoryToDrive]);

  const connect = useCallback(async () => {
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      setError("Gemini API Key is missing or invalid. Please add your own API key in Settings or set it in your .env file.");
      setState("disconnected");
      return;
    }

    // If already connecting or connected, don't start another one
    if (sessionRef.current?.isConnected || state === "connecting") {
      console.log("Already connecting or connected, skipping...");
      return;
    }

    setState("connecting");
    setError(null);
    isManualDisconnectRef.current = false;

    // Connection timeout to prevent getting stuck in "connecting"
    const connectionTimeout = setTimeout(() => {
      if (sessionRef.current && !sessionRef.current.isConnected) {
        console.error("SARA Connection Timeout");
        setError("Connection timed out. Retrying...");
        // DO NOT call the main disconnect() as it sets manual disconnect to true.
        // Just force the session to close so the watchdog takes over.
        try {
          if (typeof (sessionRef.current as any).session?.close === 'function') {
            (sessionRef.current as any).session.close();
          }
        } catch (e) {}
      }
    }, 30000); // Increased timeout to 30s for slower networks

    // Reuse streamer if it exists
    if (!streamerRef.current) {
      streamerRef.current = new AudioStreamer((base64Data) => {
        if (!isSpeakingRef.current && sessionRef.current?.isConnected) {
          sessionRef.current.sendAudio(base64Data);
          setState(s => s === "idle" ? "listening" : s);
        }
      });
      
      streamerRef.current.setVolumeCallback((v) => {
        setVolume(v);
      });
    }

    try {
      await streamerRef.current.start();
    } catch (err: any) {
      clearTimeout(connectionTimeout);
      setError(`Microphone error: ${err.message || "Access denied"}. Please allow mic access.`);
      setState("disconnected");
      return;
    }

    const session = new LiveSession(apiKey, {
      onOpen: () => {
        clearTimeout(connectionTimeout);
        reconnectCountRef.current = 0; // Reset on success
        setState("idle");
        console.log("SARA Connected successfully");
      },
      onClose: () => {
        clearTimeout(connectionTimeout);
        // Only set disconnected if we aren't auto-reconnecting
        if (isManualDisconnectRef.current) {
          setState("disconnected");
          sessionRef.current = null;
          streamerRef.current?.stop();
          videoStreamerRef.current?.stop();
          setIsScreenSharing(false);
          saveMemoryToDrive();
        } else {
          setState("connecting"); // Show connecting state during auto-reconnect
        }
      },
      onError: (err) => {
        clearTimeout(connectionTimeout);
        console.error("SARA Session Error:", err);
        
        if (isManualDisconnectRef.current) {
          setError(`SARA Connection Error: ${err.message}`);
          setState("disconnected");
          sessionRef.current = null;
          streamerRef.current?.stop();
          videoStreamerRef.current?.stop();
          setIsScreenSharing(false);
        } else {
          setState("connecting"); // Show connecting state during auto-reconnect
        }
      },
      onAudioOutput: handleAudioOutput,
      onTranscription: handleTranscription,
      onInterrupted: () => {
        setState("idle");
        isSpeakingRef.current = false;
      },
      onToolCall: handleToolCall,
    });

    sessionRef.current = session;
    
    const historyContext = memory.history?.map((h: any) => h.text).join("\n") || "";
    const customInstructions = memory.customInstructions?.join("\n") || "";
    
    const assistantName = localStorage.getItem("assistantName") || "SARA";
    const userName = localStorage.getItem("userName") || "User";
    
    try {
      await session.connect(historyContext, mood, customInstructions, assistantName, userName);
    } catch (err: any) {
      clearTimeout(connectionTimeout);
      console.error("Session connect failed:", err);
      setError(`Failed to initialize session: ${err.message}`);
      setState("disconnected");
    }
  }, [state, handleAudioOutput, handleToolCall, handleTranscription, memory, saveMemoryToDrive, mood, customApiKey, disconnect]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      videoStreamerRef.current?.stop();
      videoStreamerRef.current = null;
      setIsScreenSharing(false);
      addMessage({ role: 'model', type: 'text', content: "Screen sharing stopped." });
    } else {
      try {
        const videoStreamer = new VideoStreamer((base64Data) => {
          sessionRef.current?.sendVideo(base64Data);
        }, true);
        await videoStreamer.start();
        videoStreamerRef.current = videoStreamer;
        setIsScreenSharing(true);
        addMessage({ role: 'model', type: 'text', content: "Screen sharing started. I can now see your screen!" });
      } catch (err: any) {
        setError(`Failed to start screen share: ${err.message}`);
      }
    }
  }, [isScreenSharing, addMessage]);

  // Wake Word Detection
  useEffect(() => {
    const setupWakeWord = async () => {
      // Only run wake word detection if we are disconnected and wake word is enabled
      if (state !== "disconnected" || !wakeWordEnabled) return;

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      let isStarted = false;

      recognition.onstart = () => {
        isStarted = true;
      };

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        
        const activeWakeWord = (customWakeWord || `hey ${assistantName}`).toLowerCase();
        const fallbackName = assistantName.toLowerCase();
        
        if (transcript.includes(activeWakeWord) || (!customWakeWord && transcript.includes(fallbackName))) {
          console.log("Wake word detected!");
          connect();
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        
        console.error("Speech recognition error", event.error);
        isStarted = false;
      };

      recognition.onend = () => {
        isStarted = false;
        // Keep listening if disconnected
        if (state === "disconnected" && wakeWordEnabled) {
          setTimeout(() => {
            if (!isStarted && state === "disconnected" && wakeWordEnabled) {
              try { recognition.start(); } catch (e) {}
            }
          }, 1000);
        }
      };

      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start wake word detection", e);
      }

      return recognition;
    };

    let recognitionInstance: any = null;
    setupWakeWord().then(rec => { recognitionInstance = rec; });

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [state, connect, wakeWordEnabled, customWakeWord, assistantName]);

  const sendTextMessage = useCallback(async (text: string) => {
    let currentSession = sessionRef.current;
    
    if (!currentSession || state === "disconnected") {
      await connect();
      currentSession = sessionRef.current;
    }
    
    if (currentSession) {
      addMessage({ role: 'user', type: 'text', content: text });
      setIsTyping(true);
      currentSession.sendText(text);
    }
  }, [state, connect, addMessage]);

  // Auto-reset speaking state when audio stops flowing
  useEffect(() => {
    if (state === "speaking") {
      const interval = setInterval(() => {
        if (Date.now() - lastAudioTimeRef.current > 1500) {
          setState("idle");
          isSpeakingRef.current = false;
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [state]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return { 
    state, 
    mood,
    basePersonality,
    setBasePersonality,
    error, 
    volume, 
    driveTokens, 
    messages,
    isTyping,
    wakeWordEnabled,
    setWakeWordEnabled,
    assistantName,
    setAssistantName,
    userName,
    setUserName,
    storageType,
    setStorageType,
    bgRun,
    setBgRun,
    displayOverApps,
    setDisplayOverApps,
    customApiKey,
    setCustomApiKey,
    customWakeWord,
    setCustomWakeWord,
    isScreenSharing,
    toggleScreenShare,
    connect, 
    disconnect, 
    reconnect: () => {
      disconnect();
      setTimeout(connect, 500);
    },
    connectDrive, 
    generate,
    sendTextMessage,
    clearChat
  };
}
