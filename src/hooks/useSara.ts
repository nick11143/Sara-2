import { useState, useEffect, useRef, useCallback } from "react";
import { AudioStreamer } from "../lib/audio-streamer";
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
  const [mood, setMood] = useState<ZoyaMood>("playful");
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [driveTokens, setDriveTokens] = useState<GoogleTokens | null>(null);
  const [memory, setMemory] = useState<any>({ history: [] });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => localStorage.getItem("wakeWordEnabled") === "true");
  
  const sessionRef = useRef<LiveSession | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const isSpeakingRef = useRef(false);
  const generationServiceRef = useRef<GenerationService | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Mood Trigger Logic
  useEffect(() => {
    const interval = setInterval(() => {
      const silenceTime = Date.now() - lastActivityRef.current;
      if (silenceTime > 60000 && mood !== "annoyed") { // 1 minute silence
        setMood("annoyed");
      } else if (silenceTime > 300000) { // 5 minutes silence
        setMood("playful"); // Reset to playful after long time
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [mood]);

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
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
        setMood("playful");
      }
    }
  }, [updateActivity]);

  // Initialize Generation Service
  useEffect(() => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      generationServiceRef.current = new GenerationService(apiKey);
    }
  }, []);

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

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storageType = localStorage.getItem("storageType") || "drive";
    
    if (storageType === "local") {
      const savedMemory = localStorage.getItem('sara_local_memory');
      if (savedMemory) {
        try {
          const parsed = JSON.parse(savedMemory);
          setMemory(parsed);
          if (parsed.messages) {
            setMessages(parsed.messages);
          }
        } catch (e) {
          console.error("Failed to parse local memory", e);
        }
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
      if (err.response?.status === 401 && tokens.refresh_token) {
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
        } catch (refreshErr) {
          console.error("Failed to refresh token and load memory:", refreshErr);
        }
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
        localStorage.setItem('sara_local_memory', JSON.stringify(updatedMemory));
        setMemory(updatedMemory);
      } else if (driveTokens) {
        try {
          await GoogleDriveService.saveMemory(driveTokens, updatedMemory);
          setMemory(updatedMemory);
        } catch (err: any) {
          if (err.response?.status === 401 && driveTokens.refresh_token) {
            const newTokens = await GoogleDriveService.refreshToken(driveTokens.refresh_token);
            setDriveTokens(newTokens);
            localStorage.setItem('google_drive_tokens', JSON.stringify(newTokens));
            await GoogleDriveService.saveMemory(newTokens, updatedMemory);
            setMemory(updatedMemory);
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

  const generate = async (type: 'image' | 'video' | 'music', prompt: string, base64Image?: string) => {
    if (!generationServiceRef.current) {
      setError("Generation service not initialized.");
      return;
    }

    const prevState = state;
    setState("generating");
    setError(null);

    // Add user prompt to chat
    addMessage({ role: 'user', type: 'text', content: `Generate ${type}: ${prompt}` });

    try {
      let url = "";
      if (type === 'image') {
        url = await generationServiceRef.current.generateImage(prompt);
      } else if (type === 'video') {
        url = await generationServiceRef.current.generateVideo(prompt, base64Image);
      } else if (type === 'music') {
        url = await generationServiceRef.current.generateMusic(prompt);
      }

      addMessage({ role: 'model', type, content: url, prompt });
    } catch (err: any) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setState(prevState === "generating" ? "idle" : prevState);
    }
  };

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
    const { name, args, id } = toolCall;
    if (name === "openWebsite") {
      const { url } = args;
      window.open(url, "_blank");
      sessionRef.current?.sendToolResponse({
        functionResponses: [
          {
            name: "openWebsite",
            response: { success: true, message: `Opened ${url}` },
            id,
          },
        ],
      });
    } else if (name === "updateMemory") {
      const { instruction } = args;
      
      // Add to local memory state
      setMemory((prev: any) => {
        const newMemory = {
          ...prev,
          customInstructions: [...(prev.customInstructions || []), instruction]
        };
        return newMemory;
      });

      // Add a system message to chat
      addMessage({
        role: 'model',
        type: 'text',
        content: `*Memory Updated: I have learned your new instruction.* \n\n\`\`\`text\n${instruction}\n\`\`\``
      });

      sessionRef.current?.sendToolResponse({
        functionResponses: [
          {
            name: "updateMemory",
            response: { success: true, message: `Memory updated with instruction: ${instruction}` },
            id,
          },
        ],
      });
    }
  }, [addMessage]);

  const connect = useCallback(async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API Key is missing.");
      return;
    }

    setState("connecting");
    setError(null);

    const streamer = new AudioStreamer((base64Data) => {
      if (!isSpeakingRef.current) {
        sessionRef.current?.sendAudio(base64Data);
        setState("listening");
      }
    });
    
    let lastVolume = 0;
    streamer.setVolumeCallback((v) => {
      // Only update state if volume changed significantly to reduce re-renders
      if (Math.abs(v - lastVolume) > 0.02) {
        setVolume(v);
        lastVolume = v;
      }
    });
    streamerRef.current = streamer;

    try {
      await streamer.start();
    } catch (err) {
      setError("Microphone access denied.");
      setState("disconnected");
      return;
    }

    const session = new LiveSession(apiKey, {
      onOpen: () => {
        setState("idle");
      },
      onClose: () => {
        setState("disconnected");
        streamer.stop();
        saveMemoryToDrive();
      },
      onError: (err) => {
        setError(err.message);
        setState("disconnected");
        streamer.stop();
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
    streamerRef.current = streamer;
    
    const historyContext = memory.history?.map((h: any) => h.text).join("\n") || "";
    const customInstructions = memory.customInstructions?.join("\n") || "";
    
    const assistantName = localStorage.getItem("assistantName") || "SARA";
    const userName = localStorage.getItem("userName") || "User";
    
    await session.connect(historyContext, mood, customInstructions, assistantName, userName);
  }, [handleAudioOutput, handleToolCall, handleTranscription, memory, saveMemoryToDrive, mood]);

  // Wake Word Detection
  useEffect(() => {
    localStorage.setItem("wakeWordEnabled", String(wakeWordEnabled));
    
    let persistentStream: MediaStream | null = null;
    
    const setupWakeWord = async () => {
      // Only run wake word detection if we are disconnected and wake word is enabled
      if (state !== "disconnected" || !wakeWordEnabled) return;

      // Keep a persistent stream open to prevent the browser mic indicator from blinking
      try {
        persistentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.error("Failed to get persistent mic stream", e);
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        
        const assistantName = (localStorage.getItem("assistantName") || "SARA").toLowerCase();
        
        if (transcript.includes(assistantName) || transcript.includes(`hey ${assistantName}`)) {
          console.log("Wake word detected!");
          connect();
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        // Restart on error if it's not a 'not-allowed' error
        if (event.error !== 'not-allowed' && state === "disconnected" && wakeWordEnabled) {
          setTimeout(() => {
            try { recognition.start(); } catch (e) {}
          }, 1000);
        }
      };

      recognition.onend = () => {
        // Keep listening if disconnected
        if (state === "disconnected" && wakeWordEnabled) {
          setTimeout(() => {
            try { recognition.start(); } catch (e) {}
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
      if (persistentStream) {
        persistentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state, connect, wakeWordEnabled]);

  const disconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    streamerRef.current?.stop();
    setState("disconnected");
    isSpeakingRef.current = false;
    saveMemoryToDrive();
  }, [saveMemoryToDrive]);

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
    error, 
    volume, 
    driveTokens, 
    messages,
    isTyping,
    wakeWordEnabled,
    setWakeWordEnabled,
    connect, 
    disconnect, 
    connectDrive, 
    generate,
    sendTextMessage,
    clearChat
  };
}
