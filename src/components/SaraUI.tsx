import { useState, useRef, FormEvent, ChangeEvent, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Mic, Power, AlertCircle, Globe, Database, CheckCircle2, 
  Plus, Image as ImageIcon, Video, Music, Send, X, Loader2,
  Download, Play, Pause, User, Bot, Trash2, Menu, LogOut, Settings,
  Smartphone, Monitor, MonitorUp
} from "lucide-react";
import { useSara, SaraState, Message } from "../hooks/useSara";

export default function SaraUI() {
  const { 
    state, mood, basePersonality, setBasePersonality, error, volume, driveTokens, messages, isTyping,
    wakeWordEnabled, setWakeWordEnabled,
    assistantName, setAssistantName,
    userName, setUserName,
    storageType, setStorageType,
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
                    <input 
                      type="password" 
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder="Leave blank to use default"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff4e00]/50 text-sm"
                    />
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

                {/* Storage Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/80">Storage</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setStorageType('drive')}
                      className={`py-3 px-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${storageType === 'drive' ? 'bg-[#ff4e00]/10 border-[#ff4e00] text-[#ff4e00]' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                    >
                      <Database className="w-5 h-5" />
                      <span className="text-xs font-medium">Google Drive</span>
                    </button>
                    <button 
                      onClick={() => setStorageType('local')}
                      className={`py-3 px-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${storageType === 'local' ? 'bg-[#ff4e00]/10 border-[#ff4e00] text-[#ff4e00]' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                    >
                      <Database className="w-5 h-5" />
                      <span className="text-xs font-medium">Phone Storage</span>
                    </button>
                  </div>
                  
                  {storageType === 'drive' && (
                    <div className="pt-2">
                      <button
                        onClick={connectDrive}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                          driveTokens 
                            ? "bg-green-500/10 border-green-500/20 text-green-400" 
                            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {driveTokens ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Drive Connected</span>
                          </>
                        ) : (
                          <>
                            <Database className="w-4 h-4" />
                            <span className="text-sm font-medium">Connect Google Drive</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Chat (Top Left) */}
      {messages.length > 0 && (
        <div className="absolute top-6 left-6 z-20">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearChat}
            className="flex items-center gap-2 px-4 py-2 rounded-full border bg-white/5 border-white/10 text-white/40 hover:text-white/60 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-medium">Clear Chat</span>
          </motion.button>
        </div>
      )}

      {/* Status and Info */}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full px-6 flex-1 pt-24 pb-32 overflow-hidden">
        {/* Header (Smaller when chatting) */}
        <motion.div
          animate={{ scale: messages.length > 0 ? 0.8 : 1, y: messages.length > 0 ? -20 : 0 }}
          className="space-y-1 text-center"
        >
          <h1 className="text-4xl font-light tracking-tighter text-white/90">
            {assistantName} <span className="text-[#ff4e00] font-medium">JARVIS</span>
          </h1>
          {!messages.length && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-green-400/80 font-mono">
              Level 10 Protocol Active
            </p>
          )}
        </motion.div>

        {/* Chat Area */}
        <div className="flex-1 w-full overflow-y-auto no-scrollbar space-y-4 px-2">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-3 shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-[#ff4e00] text-white' 
                    : 'bg-white/10 border border-white/10 text-white/90'
                }`}>
                  <div className="flex items-center justify-between gap-4 mb-1 opacity-60">
                    <div className="flex items-center gap-2">
                      {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      <span className="text-[10px] font-mono uppercase tracking-wider">
                        {msg.role === 'user' ? userName : assistantName}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono">
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
                      <img src={msg.content} className="rounded-lg w-full max-h-64 object-cover border border-white/10" />
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
                      {msg.prompt && <p className="text-[10px] text-white/40 italic">{msg.prompt}</p>}
                    </div>
                  )}

                  {msg.type === 'video' && (
                    <div className="space-y-2 group/media relative">
                      <video src={msg.content} controls className="rounded-lg w-full max-h-64 object-cover border border-white/10" />
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
                      {msg.prompt && <p className="text-[10px] text-white/40 italic">{msg.prompt}</p>}
                    </div>
                  )}

                  {msg.type === 'music' && (
                    <div className="space-y-2 group/media relative">
                      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
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
                      {msg.prompt && <p className="text-[10px] text-white/40 italic">{msg.prompt}</p>}
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
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-[#ff4e00]" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-[#ff4e00]" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-[#ff4e00]" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                    {state === "generating" ? "Zoya is creating..." : state === "speaking" ? "Zoya is speaking..." : "Zoya is thinking..."}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={chatEndRef} />
        </div>

        {/* Central Visualizer (Smaller when chatting) */}
        <div className={`relative group transition-all duration-500 ${messages.length > 0 ? 'scale-50 opacity-50 hover:opacity-100' : 'scale-100'}`}>
          {/* Outer Glows */}
          <AnimatePresence mode="wait">
            {state !== "disconnected" && (
              <motion.div
                key="glow"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: state === "listening" || state === "speaking" || state === "generating" ? [1, 1.1, 1] : 1,
                  opacity: [0.4, 0.6, 0.4],
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`absolute inset-[-40px] rounded-full blur-[40px] ${
                  state === "listening" ? "bg-blue-500/30" : 
                  state === "speaking" ? "bg-[#ff4e00]/30" : 
                  state === "generating" ? "bg-purple-500/30" :
                  "bg-white/10"
                }`}
              />
            )}
          </AnimatePresence>

          {/* Main Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggle}
            className={`relative w-48 h-48 rounded-full flex items-center justify-center border transition-all duration-500 ${
              state === "disconnected" 
                ? "bg-white/5 border-white/10 hover:bg-white/10" 
                : state === "connecting" || state === "generating"
                ? "bg-white/10 border-white/20 animate-pulse"
                : "bg-white/20 border-white/30 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            }`}
          >
            {/* Volume Pulse */}
            {state === "listening" && (
              <motion.div
                animate={{
                  scale: 1 + volume * 2,
                  opacity: 0.2 + volume,
                }}
                className="absolute inset-0 rounded-full bg-blue-400/20 blur-md"
              />
            )}
            {state === "speaking" && (
              <motion.div
                animate={{
                  scale: 1 + volume * 3,
                  opacity: 0.3 + volume,
                }}
                className="absolute inset-0 rounded-full bg-[#ff4e00]/20 blur-md"
              />
            )}

            <div className="relative z-20">
              {state === "disconnected" ? (
                <Power className="w-16 h-16 text-white/60 group-hover:text-white transition-colors" />
              ) : state === "generating" ? (
                <Loader2 className="w-16 h-16 text-purple-400 animate-spin" />
              ) : (
                <div className="relative">
                  <Mic className={`w-16 h-16 transition-colors duration-500 ${
                    state === "listening" ? "text-blue-400" : 
                    state === "speaking" ? "text-[#ff4e00]" : 
                    "text-white/80"
                  }`} />
                  
                  {/* Waveform Animation */}
                  {(state === "listening" || state === "speaking") && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            scale: [1, 1.5, 2],
                            opacity: [0.5, 0.2, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: "easeOut",
                          }}
                          className={`absolute w-full h-full rounded-full border ${
                            state === "listening" ? "border-blue-400/30" : "border-[#ff4e00]/30"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.button>
        </div>

        {/* Status and Info */}
        <div className="space-y-4 w-full">
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <span className={`text-lg font-medium tracking-wide ${
              state === "listening" ? "text-blue-400" : 
              state === "speaking" ? "text-[#ff4e00]" : 
              state === "generating" ? "text-purple-400" :
              "text-white/80"
            }`}>
              {getStatusText(state)}
            </span>
          </motion.div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 text-left"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-semibold text-red-500">Something went wrong</p>
                  <p className="text-xs text-red-400/80 leading-relaxed">{error}</p>
                  <button 
                    onClick={reconnect} 
                    className="mt-2 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded-full transition-colors border border-red-500/30"
                  >
                    Try Reconnecting
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-8 left-0 right-0 px-6 flex flex-col items-center gap-4 z-30">
        {/* Selected Image Preview */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[#ff4e00]"
            >
              <img src={selectedImage} className="w-full h-full object-cover" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-xl w-full relative flex items-center gap-2">
          {/* Screen Share Toggle */}
          {state !== "disconnected" && (
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-full border transition-all ${
                isScreenSharing ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
              title={isScreenSharing ? "Stop Screen Share" : "Share Screen with SARA"}
            >
              <MonitorUp className="w-5 h-5" />
            </button>
          )}

          {/* Aspect Ratio Toggle */}
          <button
            onClick={() => setAspectRatio(prev => prev === "16:9" ? "9:16" : "16:9")}
            className="p-3 rounded-full border bg-white/5 border-white/10 text-white/60 hover:bg-white/10 transition-all"
            title={aspectRatio === "16:9" ? "Landscape (16:9)" : "Portrait (9:16)"}
          >
            {aspectRatio === "16:9" ? <Monitor className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
          </button>

          {/* Plus Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              className={`p-3 rounded-full border transition-all ${
                showPlusMenu ? "bg-[#ff4e00] border-[#ff4e00] text-white" : "bg-white/5 border-white/10 text-white/60"
              }`}
            >
              <Plus className={`w-6 h-6 transition-transform ${showPlusMenu ? "rotate-45" : ""}`} />
            </motion.button>

            <AnimatePresence>
              {showPlusMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="absolute bottom-full left-0 mb-4 bg-[#1a100d] border border-white/10 rounded-2xl p-2 flex flex-col gap-1 min-w-[160px] shadow-2xl z-50"
                >
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <ImageIcon className="w-4 h-4 text-orange-400" />
                    <span>Upload Image</span>
                  </button>
                  <div className="h-px bg-white/5 mx-2" />
                  <button 
                    onClick={() => handleGenerate('image')}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>Text to Image</span>
                  </button>
                  <button 
                    onClick={() => handleGenerate('video')}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm"
                  >
                    <Video className="w-4 h-4 text-blue-400" />
                    <span>{selectedImage ? "Image to Video" : "Text to Video"}</span>
                  </button>
                  <button 
                    onClick={() => handleGenerate('music')}
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
          <form onSubmit={handleSendText} className="flex-1 relative">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`Ask ${assistantName} or type a prompt...`}
              className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 pr-12 focus:outline-none focus:border-[#ff4e00]/50 transition-all text-sm"
            />
            <button 
              type="submit"
              disabled={!textInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#ff4e00] disabled:text-white/20 transition-colors"
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
