import { motion } from "motion/react";
import { loginWithGoogle } from "../lib/firebase";
import { useState } from "react";

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      onLogin();
    } catch (err: any) {
      setError(err.message || "Failed to login");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0502] flex flex-col items-center justify-center z-40 p-6">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center backdrop-blur-xl"
      >
        <h2 className="text-3xl font-light text-white mb-2">Welcome to SARA</h2>
        <p className="text-white/60 mb-8">Please sign in to access your personal AI assistant and memory storage.</p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-white text-black font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/90 transition-colors disabled:opacity-50 mb-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {isLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <button
          onClick={() => {
            localStorage.setItem("storageType", "local");
            onLogin();
          }}
          className="w-full bg-white/10 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white/20 transition-colors"
        >
          Continue without Login (Local Storage)
        </button>
      </motion.div>
    </div>
  );
}
