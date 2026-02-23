import React, { useEffect, useState } from 'react';
import { Sparkles, Code2 } from 'lucide-react';

const SplashScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Core...');

  useEffect(() => {
    // Progress bar animation 0 -> 100 over 3 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2; // Increments to reach 100 in roughly 3s based on interval
      });
    }, 50); // 50ms * 60 steps approx 3000ms

    // Text cycler
    const timeouts = [
      setTimeout(() => setStatusText('Loading Modules...'), 800),
      setTimeout(() => setStatusText('Verifying Environment...'), 1800),
      setTimeout(() => setStatusText('Starting DoozeHost AI...'), 2600),
    ];

    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-firebase-orange/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-firebase-blue/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Animated Logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-firebase-orange blur-2xl opacity-50 animate-pulse rounded-full"></div>
          <div className="relative bg-gradient-to-br from-firebase-yellow to-firebase-orange p-5 rounded-2xl shadow-2xl border border-white/20 transform animate-bounce-slow">
            {/* Custom Logo */}
            <svg viewBox="0 0 100 100" className="w-12 h-12 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
              {/* Left Pill */}
              <rect x="10" y="10" width="30" height="80" rx="15" />
              {/* Right D Shape */}
              <path d="M 50 10 L 70 10 A 40 40 0 0 1 70 90 L 50 90 L 50 65 L 70 65 A 15 15 0 0 0 70 35 L 50 35 Z" />
            </svg>
          </div>
          
          {/* Orbiting Icons */}
          <div className="absolute inset-0 animate-spin-slow pointer-events-none">
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 p-1.5 rounded-full border border-white/10 shadow-lg">
                <Sparkles className="w-4 h-4 text-firebase-yellow" />
             </div>
             <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 p-1.5 rounded-full border border-white/10 shadow-lg">
                <Code2 className="w-4 h-4 text-blue-400" />
             </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
          DoozeHost <span className="text-transparent bg-clip-text bg-gradient-to-r from-firebase-yellow to-firebase-orange">Assistant</span>
        </h1>
        
        <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.2em] mb-8 animate-pulse">
          {statusText}
        </p>

        {/* Progress Bar Container */}
        <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
          {/* Fill */}
          <div 
            className="h-full bg-gradient-to-r from-firebase-yellow to-firebase-orange shadow-[0_0_10px_rgba(255,160,0,0.5)] transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Percentage (Optional aesthetic detail) */}
        <div className="mt-2 text-[10px] text-slate-500 font-mono">
          {Math.min(100, Math.floor(progress))}%
        </div>
      </div>

      {/* Footer Version */}
      <div className="absolute bottom-6 text-slate-600 text-[10px] font-mono">
        v1.0.0 • POWERED BY GEMINI
      </div>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;