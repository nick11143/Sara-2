import { useState, useRef, FormEvent, ChangeEvent, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Mic, Power, AlertCircle, Globe, Database, CheckCircle2, 
  Plus, Image as ImageIcon, Video, Music, Send, X, Loader2,
  Download, Play, Pause, User, Bot, Trash2, Menu, LogOut, Settings,
  Smartphone, Monitor, MonitorUp, ClipboardPaste
} from "lucide-react";
import { useSara, SaraState, Message } from "../hooks/useSara";
import { Canvas } from "@react-three/fiber";
import Orb from "./Orb";

export default function SaraUI() {
  const { 
    state, mood, basePersonality, setBasePersonality, error, volume, driveTokens, messages, isTyping,
    wakeWordEnabled, setWakeWordEnabled,
    assistantName, setAssistantName,
    userName, setUserName,
    bgRun, setBgRun,
    displayOverApps, setDisplayOverApps,
    customApiKey, setCustomApiKey,
    customWakeWord, setCustomWakeWord,
    isScreenSharing, toggleScreenShare,
    connect, disconnect, reconnect, connectDrive, generate, sendTextMessage, clearChat
  } = useSara();

  const [textInput, setTextInput] = useState("");
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [pasteMessage, setPasteMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const moodColors = {
    playful: "from-[#ff4e00]",
    curious: "from-blue-500",
    annoyed: "from-gray-600",
    excited: "from-pink-500"
  };

  const moodIcons = {
    playful: "😉",
    curious: "🧐",
    annoyed: "😒",
    excited: "🤩"
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleToggle = () => {
    if (state === "disconnected") {
      connect();
    } else {
      disconnect();
    }
  };

  const handleSendText = (e?: FormEvent) => {
    e?.preventDefault();
    if (textInput.trim()) {
      sendTextMessage(textInput);
      setTextInput("");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = (type: 'image' | 'video' | 'music') => {
    if (!textInput.trim() && type !== 'video') {
      alert("Please enter a prompt first!");
      return;
    }
    generate(type, textInput, selectedImage || undefined, aspectRatio);
    setShowPlusMenu(false);
    setTextInput("");
    setSelectedImage(null);
  };

  const getStatusText = (state: SaraState) => {
    switch (state) {
      case "disconnected": return "Tap to wake me up";
      case "connecting": return "Getting ready for you...";
      case "idle": return `${assistantName} is ${mood} ${moodIcons[mood]}`;
      case "listening": return "Listening to your sweet voice...";
      case "speaking": return `${assistantName} is speaking`;
      case "generating": return "Creating magic for you...";
      default: return "";
    }
  };

  const [showDrivePrompt, setShowDrivePrompt] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  const handleConnectDrive = async () => {
    await connectDrive();
    setShowDrivePrompt(false);
  };

  const handleLogout = () => {
    import('../lib/firebase').then(({ logout }) => {
      logout();
    });
  };

  return (
    <div className="fixed inset-0 bg-[#0a0502] text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[20%] left-[10%] w-[80vw] h-[80vw] rounded-full bg-gradient-to-br ${moodColors[mood]} to-transparent blur-[120px]`}
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-[#3a1510] to-transparent blur-[100px]"
        />
      </div>

      {/* Top Right Menu */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full border bg-white/5 border-white/10 text-white/40 hover:text-white/60 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-medium hidden sm:inline">Logout</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowProfile(true)}
          className="p-2.5 rounded-full border bg-white/5 border-white/10 text-white/40 hover:text-white/60 transition-all"
        >
          <Menu className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a100c] border border-white/10 rounded-3xl p-6 max-w-md w-full relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setShowProfile(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-[#ff4e00]" />
                <h2 className="text-2xl font-medium">Profile & Settings</h2>
              </div>

              <div className="space-y-6">
                {/* Names */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Assistant Name</label>
                    <input 
                      type="text" 
                      value={assistantName}
                      onChange={(e) => setAssistantName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff4e00]/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Your Name</label>
                    <input 
                      type="text" 
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff4e00]/50 text-sm"
                    />
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                {/* Personality Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">Personality</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(['playful', 'curious', 'annoyed', 'excited'] as const).map((p) => (
                      <button 
                        key={p}
                        onClick={() => setBasePersonality(p)}
                        className={`py-2 px-3 rounded-xl border transition-all text-sm capitalize ${basePersonality === p ? 'bg-[#ff4e00]/10 border-[#ff4e00] text-[#ff4e00]' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                      >
                        {p} {moodIcons[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                {/* App Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">App Settings</h3>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-white/60 group-hover:text-white transition-colors">Wake Word Detection</span>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${wakeWordEnabled ? 'bg-[#ff4e00]' : 'bg-white/10'}`}>
                      <input type="checkbox" className="hidden" checked={wakeWordEnabled} onChange={(e) => setWakeWordEnabled(e.target.checked)} />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${wakeWordEnabled ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                  
                  {wakeWordEnabled && (
                    <div>
                      <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Custom Wake Word</label>
                      <input 
                        type="text" 
                        value={customWakeWord}
                        onChange={(e) => setCustomWakeWord(e.target.value)}
                        placeholder={`e.g. Hey ${assistantName}`}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff4e00]/50 text-sm"
                      />
                      <p className="text-xs text-white/40 mt-1">Leave blank to use default: "Hey {assistantName}"</p>
                    </div>
                  )}

                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-white/60 group-hover:text-white transition-colors">Display over other apps</span>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${displayOverApps ? 'bg-[#ff4e00]' : 'bg-white/10'}`}>
                      <input type="checkbox" className="hidden" checked={displayOverApps} onChange={(e) => setDisplayOverApps(e.target.checked)} />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${displayOverApps ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-white/60 group-hover:text-white transition-colors">Run in background</span>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${bgRun ? 'bg-[#ff4e00]' : 'bg-white/10'}`}>
                      <input type="checkbox" className="hidden" checked={bgRun} onChange={(e) => setBgRun(e.target.checked)} />
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${bgRun ? 'left-5' : 'left-1'}`} />
                    </div>
                  </label>
                </div>

                <div className="h-px bg-white/10" />

                {/* API Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">API Settings</h3>
                  <div>
                    <label className="block text-xs text-white/40 mb-1 uppercase tracking-wider">Custom Gemini API Key</label>
                    <div className="relative">
                      <input 
                        type="password" 
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        placeholder="Leave blank to use default"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-12 focus:outline-none focus:border-[#ff4e00]/50 text-sm"
                      />
                      <button
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setCustomApiKey(text);
                              setPasteMessage("Pasted successfully!");
                              setTimeout(() => setPasteMessage(""), 2000);
                            }
                          } catch (err) {
                            console.error("Failed to read clipboard contents: ", err);
                            setPasteMessage("Please press Ctrl+V / Cmd+V to paste");
                            setTimeout(() => setPasteMessage(""), 3000);
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                      </button>
                    </div>
                    {pasteMessage && <p className={`text-xs mt-1 ${pasteMessage.includes('Ctrl') ? 'text-red-400' : 'text-green-400'}`}>{pasteMessage}</p>}
                    <p className="text-xs text-white/40 mt-1">Changes take effect on reconnect.</p>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                {/* Share SARA */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">Share SARA</h3>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly
                      value="https://ais-pre-5ucyjqvv22vdfauqzmux65-557778769004.asia-southeast1.run.app"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 focus:outline-none"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText("https://ais-pre-5ucyjqvv22vdfauqzmux65-557778769004.asia-southeast1.run.app");
                        alert("Link copied!");
                      }}
                      className="bg-[#ff4e00] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#ff4e00]/90 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-white/40">Share this link with friends so they can use SARA directly.</p>
                </div>

                <div className="h-px bg-white/10" />

                {/* Chrome Extension */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">Chrome Extension</h3>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Install the SARA Chrome Extension to wake her up from any tab or your home screen just by saying "Hey SARA".
                  </p>
                  <a 
                    href="/extension/manifest.json" 
                    download="manifest.json"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("To install:\n1. Click the Download button below.\n2. Extract the ZIP file.\n3. Go to chrome://extensions\n4. Enable Developer Mode\n5. Click 'Load unpacked' and select the extracted folder.");
                      window.open("https://ais-pre-5ucyjqvv22vdfauqzmux65-557778769004.asia-southeast1.run.app", "_blank"); // Fallback if zip is hard to generate, but we can just instruct them to download the files or use a script.
                    }}
                    className="hidden"
                  ></a>
                  <button 
                    onClick={() => {
                      // Create a simple zip or just instruct the user
                      alert("I have created the Chrome Extension files for you!\n\nTo get them:\n1. Click the 'Export' or 'Download' button in your AI Studio editor (top right).\n2. Extract the ZIP.\n3. Find the 'public/extension' folder.\n4. Go to chrome://extensions in your browser.\n5. Turn on 'Developer mode'.\n6. Click 'Load unpacked' and select the 'extension' folder.\n\nNow you can say 'Hey SARA' from anywhere!");
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Get Chrome Extension
                  </button>
                </div>

                <div className="h-px bg-white/10" />

                {/* Force Reset */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-red-400">Troubleshooting</h3>
                  <p className="text-xs text-white/40 leading-relaxed">
                    If SARA is acting weird or won't connect, try a Force Reset. This will clear all local settings and reload the app.
                  </p>
                  <button 
                    onClick={() => {
                      if (confirm("Are you sure? This will clear your local settings and memory (if not saved to Drive).")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Power className="w-4 h-4" />
                    Force Reset App
                  </button>
                </div>

                <div className="h-px bg-white/10" />

                {/* Memory Storage */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">Memory Storage</h3>
                  <p className="text-xs text-white/40 leading-relaxed">
                    SARA uses a hybrid storage system. Your memory is always saved locally with AES encryption for quick access. 
                    Connect Google Drive to securely sync your memory across devices.
                  </p>
                  
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Database className={`w-5 h-5 ${driveTokens ? 'text-green-400' : 'text-white/40'}`} />
                        <div>
                          <p className="text-sm font-medium">{driveTokens ? 'Google Drive Connected' : 'Google Drive Disconnected'}</p>
                          <p className="text-xs text-white/40">{driveTokens ? 'Memory is syncing securely' : 'Connect to sync memory'}</p>
                        </div>
                      </div>
                      {!driveTokens ? (
                        <button 
                          onClick={connectDrive}
                          className="px-3 py-1.5 bg-[#ff4e00] text-white text-xs font-medium rounded-lg hover:bg-[#ff4e00]/90 transition-colors"
                        >
                          Connect
                        </button>
                      ) : (
                        <span className="px-2 py-1 bg-green-400/10 text-green-400 text-[10px] font-medium rounded uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Chat (Top Right) */}
      {messages.length > 0 && (
        <div className="absolute top-6 left-24 z-20">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearChat}
            className="flex items-center gap-2 px-4 py-2 rounded-full border bg-white/5 border-white/10 text-white/40 hover:text-white/60 transition-all backdrop-blur-md"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-medium">Clear Chat</span>
          </motion.button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex w-full h-full px-6 pt-24 pb-32 overflow-hidden gap-8">
        
        {/* Left Side: Improved Chat Area */}
        <div className={`flex flex-col transition-all duration-700 ${messages.length > 0 ? 'w-1/3' : 'w-0 opacity-0 pointer-events-none'}`}>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[90%] rounded-3xl p-4 shadow-2xl backdrop-blur-md transition-all ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-[#ff4e00] to-[#ff8c00] text-white rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none'
                  }`}>
                    <div className="flex items-center justify-between gap-4 mb-2 opacity-50">
                      <div className="flex items-center gap-2">
                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                        <span className="text-[9px] font-mono uppercase tracking-widest">
                          {msg.role === 'user' ? userName : assistantName}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {msg.type === 'text' && (
                      <div className={`text-sm leading-relaxed prose prose-invert prose-sm max-w-none ${msg.role === 'user' ? 'prose-headings:text-white prose-strong:text-white prose-a:text-white/80' : ''}`}>
                        <ReactMarkdown
                          components={{
                            code({node, inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  {...props}
                                  children={String(children).replace(/\n$/, '')}
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-xl overflow-hidden text-xs my-2"
                                />
                              ) : (
                                <code {...props} className={`${className} bg-black/30 px-1.5 py-0.5 rounded text-[#ff4e00]`}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {msg.type === 'image' && (
                      <div className="space-y-2 group/media relative">
                        <img src={msg.content} className="rounded-2xl w-full max-h-64 object-cover border border-white/10 shadow-lg" />
                        <a 
                          href={msg.content} 
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`sara-image-${msg.id}.png`}
                          className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white/80 hover:text-[#ff4e00] transition-colors shadow-lg backdrop-blur-sm"
                          title="Download Image"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {msg.prompt && <p className="text-[10px] text-white/40 italic px-1">{msg.prompt}</p>}
                      </div>
                    )}

                    {msg.type === 'video' && (
                      <div className="space-y-2 group/media relative">
                        <video src={msg.content} controls className="rounded-2xl w-full max-h-64 object-cover border border-white/10 shadow-lg" />
                        <a 
                          href={msg.content} 
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`sara-video-${msg.id}.mp4`}
                          className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white/80 hover:text-[#ff4e00] transition-colors shadow-lg backdrop-blur-sm"
                          title="Download Video"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {msg.prompt && <p className="text-[10px] text-white/40 italic px-1">{msg.prompt}</p>}
                      </div>
                    )}

                    {msg.type === 'music' && (
                      <div className="space-y-2 group/media relative">
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 shadow-inner">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Music className="w-5 h-5 text-green-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium">Generated Music</p>
                            <audio src={msg.content} controls className="h-8 w-full mt-1" />
                          </div>
                          <a 
                            href={msg.content} 
                            target="_blank"
                            rel="noopener noreferrer"
                            download={`sara-music-${msg.id}.wav`}
                            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-green-400 transition-colors"
                            title="Download Music"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                        {msg.prompt && <p className="text-[10px] text-white/40 italic px-1">{msg.prompt}</p>}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {(state === "generating" || state === "speaking" || isTyping) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3 shadow-xl backdrop-blur-sm">
                    <div className="flex gap-1.5">
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 rounded-full bg-[#ff4e00]" />
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#ff4e00]" />
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#ff4e00]" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                      {state === "generating" ? `${assistantName} is creating...` : state === "speaking" ? `${assistantName} is speaking...` : `${assistantName} is thinking...`}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Right Side: 3D Orb Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Header */}
          <motion.div
            animate={{ scale: messages.length > 0 ? 0.9 : 1, y: messages.length > 0 ? -40 : 0 }}
            className="absolute top-0 space-y-2 text-center"
          >
            <h1 className="text-5xl font-light tracking-tighter text-white/90">
              {assistantName} <span className="text-[#ff4e00] font-medium">JARVIS</span>
            </h1>
            {!messages.length && (
              <p className="text-[10px] uppercase tracking-[0.4em] text-green-400/80 font-mono">
                Level 10 Protocol Active
              </p>
            )}
          </motion.div>

          <div className="w-full h-full max-w-2xl max-h-[600px] relative">
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />
              <Orb state={state} volume={volume} isTyping={isTyping} />
            </Canvas>
            
            {/* Interaction Layer */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggle}
                className="w-64 h-64 rounded-full cursor-pointer z-10"
                title={state === "disconnected" ? "Connect SARA" : "Disconnect SARA"}
              />
            </div>

            {/* Status Text Overlay */}
            <motion.div
              key={state}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
            >
              <span className={`text-xl font-medium tracking-widest uppercase ${
                state === "listening" ? "text-blue-400" : 
                state === "speaking" ? "text-[#ff4e00]" : 
                state === "generating" ? "text-purple-400" :
                "text-white/40"
              }`}>
                {getStatusText(state)}
              </span>
            </motion.div>
          </div>

          {/* Error Message */}
          <div className="absolute bottom-0 w-full max-w-md">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-3xl p-5 flex items-start gap-4 text-left backdrop-blur-md"
                >
                  <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-bold text-red-500 uppercase tracking-wider">System Alert</p>
                    <p className="text-xs text-red-400/80 leading-relaxed">{error}</p>
                    <button 
                      onClick={reconnect} 
                      className="mt-3 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-1.5 rounded-full transition-all border border-red-500/30 font-bold uppercase tracking-widest"
                    >
                      Initialize Reconnect
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-8 left-0 right-0 px-6 flex flex-col items-center gap-4 z-30">
        {/* Selected Image Preview */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute bottom-full mb-4 p-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex items-center gap-3"
            >
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10">
                <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="pr-4">
                <p className="text-xs font-medium text-white/80">Image selected</p>
                <p className="text-[10px] text-white/40">Ready for generation</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-2xl w-full relative flex items-center gap-3">
          {/* Screen Share Toggle */}
          {state !== "disconnected" && (
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-2xl border transition-all shadow-lg ${
                isScreenSharing ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
              title={isScreenSharing ? "Stop Screen Share" : "Share Screen with SARA"}
            >
              <MonitorUp className="w-6 h-6" />
            </button>
          )}

          {/* Aspect Ratio Toggle */}
          <button
            onClick={() => setAspectRatio(prev => prev === "16:9" ? "9:16" : "16:9")}
            className="p-4 rounded-2xl border bg-white/5 border-white/10 text-white/60 hover:bg-white/10 transition-all shadow-lg"
            title="Toggle Aspect Ratio"
          >
            <div className={`w-6 h-6 border-2 border-current rounded-sm transition-all ${aspectRatio === "16:9" ? "scale-x-125 scale-y-75" : "scale-x-75 scale-y-125"}`} />
          </button>

          {/* Plus Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              className={`p-4 rounded-2xl border transition-all shadow-lg ${
                showPlusMenu ? "bg-[#ff4e00] border-[#ff4e00] text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              <Plus className={`w-6 h-6 transition-transform duration-300 ${showPlusMenu ? "rotate-45" : ""}`} />
            </motion.button>

            <AnimatePresence>
              {showPlusMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="absolute bottom-full left-0 mb-4 bg-[#1a100d] border border-white/10 rounded-2xl p-2 flex flex-col gap-1 min-w-[160px] shadow-2xl z-50 backdrop-blur-xl"
                >
                  <button 
                    onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <ImageIcon className="w-4 h-4 text-orange-400" />
                    <span>Upload Image</span>
                  </button>
                  <div className="h-px bg-white/5 mx-2" />
                  <button 
                    onClick={() => { handleGenerate('image'); setShowPlusMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>Text to Image</span>
                  </button>
                  <button 
                    onClick={() => { handleGenerate('video'); setShowPlusMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <Video className="w-4 h-4 text-blue-400" />
                    <span>{selectedImage ? "Image to Video" : "Text to Video"}</span>
                  </button>
                  <button 
                    onClick={() => { handleGenerate('music'); setShowPlusMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <Music className="w-4 h-4 text-green-400" />
                    <span>Text to Music</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text Input */}
          <form onSubmit={handleSendText} className="flex-1 relative group">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`Ask ${assistantName} or type a prompt...`}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-12 focus:outline-none focus:border-[#ff4e00]/50 transition-all text-sm backdrop-blur-md shadow-2xl"
            />
            <button 
              type="submit"
              disabled={!textInput.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 transition-all ${textInput.trim() ? "text-[#ff4e00] hover:bg-[#ff4e00]/10" : "text-white/20"}`}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-mono">
          {assistantName} v2.0 • Multimodal Generation
        </div>
      </div>
    </div>
  );
}
