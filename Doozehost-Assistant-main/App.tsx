import React, { useState, useEffect } from 'react';
import { ProjectConfig, StepStatus } from './types';
import ConfigurationForm from './components/ConfigurationForm';
import GuideViewer from './components/GuideViewer';
import GeminiAssistant from './components/GeminiAssistant';
import SplashScreen from './components/SplashScreen';
import { Github, Download, WifiOff } from 'lucide-react';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true); // Loading state
  const [status, setStatus] = useState<StepStatus>(StepStatus.CONFIG);
  const [config, setConfig] = useState<ProjectConfig>({
    projectId: '',
    publicDir: 'dist',
    isSpa: true,
    githubAction: false,
    framework: 'Vite'
  });

  // AI Assistant State lifted up
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContextMessage, setAiContextMessage] = useState<string | null>(null);

  // PWA State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // PWA & Splash Screen Logic
  useEffect(() => {
    // Splash Timer
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000); 

    // Offline Status Listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Install Prompt Listener
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setInstallPrompt(null);
    });
  };

  const handleGenerate = () => {
    setStatus(StepStatus.GUIDE);
  };

  const handleBack = () => {
    setStatus(StepStatus.CONFIG);
  };

  const handleAskAi = (context: string) => {
    setAiContextMessage(context);
    setIsAiOpen(true);
  };

  // Render Splash Screen if loading
  if (loading) {
    return <SplashScreen />;
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden animate-in fade-in duration-700">
      
      {/* Ambient Background Effects */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      {/* Offline Banner */}
      {isOffline && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-red-600/90 text-white text-xs font-bold py-1 px-4 text-center backdrop-blur-sm animate-in slide-in-from-top flex items-center justify-center">
          <WifiOff className="w-3 h-3 mr-2" />
          You are offline. AI features may not work.
        </div>
      )}

      {/* Header */}
      <header className={`flex-none glass z-40 h-16 flex items-center px-6 justify-between border-b border-white/5 ${isOffline ? 'mt-6' : ''} transition-all duration-300`}>
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={handleBack}>
          <div className="relative">
            <div className="absolute inset-0 bg-firebase-orange blur-lg opacity-40 group-hover:opacity-75 transition-opacity rounded-full"></div>
            <div className="relative bg-gradient-to-br from-firebase-yellow to-firebase-orange p-2 rounded-xl shadow-lg border border-white/20">
              {/* Custom Logo */}
              <svg viewBox="0 0 100 100" className="w-5 h-5 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
                {/* Left Pill */}
                <rect x="10" y="10" width="30" height="80" rx="15" />
                {/* Right D Shape */}
                <path d="M 50 10 L 70 10 A 40 40 0 0 1 70 90 L 50 90 L 50 65 L 70 65 A 15 15 0 0 0 70 35 L 50 35 Z" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            DoozeHost <span className="font-light text-gray-400">Assistant</span>
          </h1>
        </div>
        <div className="flex items-center space-x-6">
          {/* PWA Install Button */}
          {installPrompt && (
            <button 
              onClick={handleInstallClick}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-white transition-all border border-white/10 shadow-lg animate-pulse"
            >
              <Download className="w-3 h-3" />
              <span>Install App</span>
            </button>
          )}

          <a href="https://firebase.google.com/docs/hosting" target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-400 hover:text-firebase-yellow transition-colors hidden md:block">Docs</a>
          <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-400 hover:text-firebase-yellow transition-colors hidden md:block">Console</a>
          <div className="w-px h-4 bg-gray-700 hidden md:block"></div>
          <div className="flex items-center text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
             v1.0.0
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative z-10">
        
        {status === StepStatus.CONFIG && (
          <div className="h-full flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in duration-500">
            <ConfigurationForm 
              config={config} 
              setConfig={setConfig} 
              onGenerate={handleGenerate} 
            />
          </div>
        )}

        {status === StepStatus.GUIDE && (
          <div className="h-full animate-in slide-in-from-right duration-500">
            <GuideViewer 
              config={config} 
              onBack={handleBack}
              onAskAi={handleAskAi}
            />
          </div>
        )}
      </main>

      {/* AI Assistant - Always available but contextual */}
      <GeminiAssistant 
        config={config} 
        isOpen={isAiOpen} 
        setIsOpen={setIsAiOpen}
        initialMessage={aiContextMessage}
        clearInitialMessage={() => setAiContextMessage(null)}
      />
    </div>
  );
};

export default App;