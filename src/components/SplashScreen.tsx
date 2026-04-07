import { motion } from "motion/react";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-[#0a0502] flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-6xl font-light tracking-tighter text-white/90 mb-4">
          SARA <span className="text-[#ff4e00] font-medium">AI</span>
        </h1>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-[#ff4e00] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-[#ff4e00] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-[#ff4e00] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-white/40 text-sm mt-4 font-mono uppercase tracking-widest">Loading Core Systems...</p>
      </motion.div>
    </div>
  );
}
