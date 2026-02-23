import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectConfig } from '../types';
import { Copy, Check, Download, Terminal, ArrowLeft, HelpCircle, Rocket, Zap, ChevronRight, ChevronLeft, Monitor, Folder, RefreshCw, GitBranch, GitCommit, PlayCircle, Server, LayoutDashboard } from 'lucide-react';

interface Props {
  config: ProjectConfig;
  onBack: () => void;
  onAskAi: (message: string) => void;
}

interface TerminalHistoryItem {
  type: 'command' | 'output' | 'error';
  content: string;
  stepId?: string;
}

const GuideViewer: React.FC<Props> = ({ config, onBack, onAskAi }) => {
  // Defaults to CI/CD mode if githubAction is enabled
  const [guideMode, setGuideMode] = useState<'terminal' | 'cicd'>(config.githubAction ? 'cicd' : 'terminal');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [terminalInput, setTerminalInput] = useState('');
  const [history, setHistory] = useState<TerminalHistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewOs, setPreviewOs] = useState<'win' | 'unix'>('win');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Focus input when terminal is active
  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus();
    }
  }, [guideMode, isProcessing, history]);

  // Scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isProcessing]);

  // Reset steps when mode changes
  useEffect(() => {
    setActiveStepIndex(0);
    setHistory([]);
  }, [guideMode]);

  const steps = useMemo(() => {
    if (guideMode === 'cicd') {
        return [
            { id: 'status', title: 'Check Status', desc: 'Cek perubahan file.', command: 'git status', output: `On branch main\nChanges not staged for commit:\n  modified: src/App.tsx`, hint: 'Pastikan ada perubahan.' },
            { id: 'add', title: 'Stage Changes', desc: 'Siapkan file untuk commit.', command: 'git add .', output: ``, hint: 'Menandai semua file.' },
            { id: 'commit', title: 'Commit', desc: 'Simpan snapshot versi.', command: 'git commit -m "deploy update"', output: `[main 8f2a1d] deploy update\n 1 file changed, 10 insertions(+)`, hint: 'Berikan pesan yang jelas.' },
            { id: 'push', title: 'Push & Deploy', desc: 'Kirim ke GitHub -> Trigger Firebase.', command: 'git push origin main', output: `Enumerating objects: 5, done.\nTo https://github.com/user/repo.git\n   8f2a1d..9a3b2c  main -> main`, hint: 'GitHub Action akan berjalan otomatis!' },
            { id: 'monitor', title: 'Monitor Build', desc: 'Buka tab Actions di GitHub.', command: 'echo "Opening GitHub..."', output: `Membuka browser...`, hint: 'Tunggu centang hijau di GitHub.' }
        ];
    }

    const baseSteps = [
      { id: 'install', title: 'Install CLI', desc: 'Install Firebase Tools global.', command: 'npm install -g firebase-tools', output: `+ firebase-tools@latest\nadded 532 packages in 12s\nfound 0 vulnerabilities`, hint: 'Gunakan sudo jika error permission.' },
      { id: 'login', title: 'Login Google', desc: 'Hubungkan akun Google.', command: 'firebase login', output: `Waiting for authentication...\nSuccess! Logged in as user@gmail.com`, hint: 'Browser akan terbuka otomatis.' },
      { id: 'init', title: 'Init Project', desc: 'Inisialisasi config.', command: 'firebase init hosting', output: `? What do you want to use as your public directory? ${config.publicDir}\n? Configure as a single-page app? ${config.isSpa ? 'Yes' : 'No'}\n✔ Firebase initialization complete!`, hint: 'Ketik Y atau Enter saat ditanya.' },
      { id: 'build', title: 'Build App', desc: `Compile kode ke /${config.publicDir}.`, command: 'npm run build', output: `vite v5.0.0 building for production...\n✓ ${config.structure?.length || 50} modules transformed.\n${config.publicDir}/index.html   0.45 kB\n✓ Built in 1.45s`, hint: 'Pastikan tidak ada error merah.' },
      { id: 'deploy', title: 'Deploy Live', desc: 'Upload file ke server.', command: config.projectId ? `firebase deploy --only hosting --project ${config.projectId}` : 'firebase deploy --only hosting', output: `Deploying to '${config.projectId || 'app'}'...\n✔ Deploy complete!\n\nHosting URL: https://${config.projectId || 'app'}.web.app`, hint: 'Website live!' }
    ];

    let s = [...baseSteps];
    if (config.framework === 'GoogleAI') s.unshift({ id: 'setup-ai', title: 'Install Deps', desc: 'Install node modules.', command: 'npm install', output: `added 142 packages in 5s\nfound 0 vulnerabilities`, hint: 'Wajib untuk project baru.' });
    return s;
  }, [config, guideMode]);

  const currentStep = steps[activeStepIndex];
  const isFinished = activeStepIndex >= steps.length;

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const inputCmd = terminalInput.trim();
    setHistory(prev => [...prev, { type: 'command', content: inputCmd }]);
    setTerminalInput('');
    setIsProcessing(true);

    const delay = Math.random() * 800 + 500;

    setTimeout(() => {
      // Relaxed matching
      const expected = currentStep.command.toLowerCase().replace(/\s+/g, ' ');
      const actual = inputCmd.toLowerCase().replace(/\s+/g, ' ');
      
      const isGitCommit = expected.startsWith('git commit') && actual.startsWith('git commit');
      const isEcho = expected.startsWith('echo') && actual.startsWith('echo');

      if (actual === expected || isGitCommit || isEcho || (actual === 'npm i' && expected.startsWith('npm install'))) {
        setHistory(prev => [...prev, { type: 'output', content: currentStep.output, stepId: currentStep.id }]);
        if (activeStepIndex < steps.length - 1) {
            setActiveStepIndex(prev => prev + 1);
        } else {
            setActiveStepIndex(prev => prev + 1);
            setHistory(prev => [...prev, { type: 'output', content: guideMode === 'cicd' ? "🚀 Triggered! Cek GitHub Actions Anda." : "🎉 Selesai! Website Online." }]);
        }
      } else {
        setHistory(prev => [...prev, { type: 'error', content: `Command not recognized: '${inputCmd}'.\nDid you mean: '${currentStep.command}'?` }]);
      }
      setIsProcessing(false);
    }, delay);
  };

  const skipStep = () => {
     setHistory(prev => [...prev, { type: 'command', content: currentStep.command }, { type: 'output', content: currentStep.output }]);
     if (activeStepIndex < steps.length - 1) setActiveStepIndex(prev => prev + 1);
     else setActiveStepIndex(prev => prev + 1);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getScriptContent = (os: 'win' | 'unix') => {
    // Manual CLI steps for script download
    const manualSteps = [
      { command: 'npm install -g firebase-tools' },
      { command: 'firebase login' },
      { command: 'firebase init hosting' },
      { command: 'npm run build' },
      { command: config.projectId ? `firebase deploy --only hosting --project ${config.projectId}` : 'firebase deploy --only hosting' }
    ];
    
    if (os === 'win') {
      return `@echo off\n\necho [DoozeHost] Deployment Otomatis...\n` + manualSteps.map(s => `echo Running: ${s.command}\ncall ${s.command}\nif %errorlevel% neq 0 ( pause & exit /b )\n`).join('\n') + `\necho [SUKSES]!\npause`;
    } else {
      return `#!/bin/bash\necho "[DoozeHost] Deployment..."\n` + manualSteps.map(s => `echo "Running: ${s.command}"\n${s.command}\nif [ $? -ne 0 ]; then exit 1; fi\n`).join('\n') + `\necho "[SUCCESS]!"`;
    }
  };

  const handleAskAlternatives = () => {
      onAskAi(`Saya sedang mendeploy proyek ${config.framework} (${config.isSpa ? 'SPA' : 'Static'}). Tolong berikan perbandingan obyektif antara hosting di Firebase, Vercel, dan Netlify untuk kasus saya. Mana yang termudah dan paling performant?`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans">
      
      {/* 1. TOP HEADER */}
      <header className="flex-none bg-slate-900/80 backdrop-blur border-b border-white/5 p-4 flex flex-col md:flex-row items-center justify-between z-30 gap-4 md:gap-0">
        <div className="flex items-center w-full md:w-auto">
            <button onClick={onBack} className="flex items-center text-slate-400 hover:text-white transition-colors group mr-4">
            <div className="p-1.5 rounded-full bg-white/5 mr-2 group-hover:bg-white/10">
                <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold hidden md:inline">Back</span>
            </button>
            
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-white/10">
                <button 
                  onClick={() => setGuideMode('terminal')}
                  className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${guideMode === 'terminal' ? 'bg-slate-800 text-white shadow-sm border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Terminal className="w-3 h-3 mr-2" />
                    Manual CLI
                </button>
                {config.githubAction && (
                    <button 
                    onClick={() => setGuideMode('cicd')}
                    className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${guideMode === 'cicd' ? 'bg-green-900/30 text-green-400 border border-green-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <GitBranch className="w-3 h-3 mr-2" />
                        GitHub CI/CD
                    </button>
                )}
            </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
             <button
                onClick={handleAskAlternatives}
                className="flex items-center px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold transition-all group"
             >
                <LayoutDashboard className="w-3 h-3 mr-2 group-hover:scale-110 transition-transform" />
                Saran Hosting Lain
             </button>
            <div className="flex items-center text-xs font-mono bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 text-slate-400">
                <Folder className="w-3 h-3 mr-2 text-firebase-orange" />
                ~/{config.projectId || 'my-project'}
            </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* LEFT: STEP NAVIGATOR */}
        <aside className="w-full md:w-72 bg-slate-900 border-r border-white/5 flex flex-col overflow-y-auto">
          <div className="p-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Deployment Steps</h3>
            <div className="space-y-2 relative">
              {/* Connector Line */}
              <div className="absolute left-3.5 top-2 bottom-2 w-px bg-slate-800 z-0"></div>
              
              {steps.map((step, idx) => {
                const isActive = idx === activeStepIndex;
                const isDone = idx < activeStepIndex;
                
                return (
                  <div 
                    key={step.id}
                    className={`relative z-10 flex items-center p-3 rounded-xl transition-all duration-300 ${
                      isActive ? 'bg-slate-800 border border-white/10 shadow-lg translate-x-1' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-3 border-2 shrink-0 transition-colors ${
                      isActive ? 'bg-firebase-blue border-firebase-blue text-white shadow-[0_0_10px_rgba(3,155,229,0.4)]' : 
                      isDone ? 'bg-green-500/10 border-green-500 text-green-500' : 
                      'bg-slate-900 border-slate-700 text-slate-600'
                    }`}>
                      {isDone ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${isActive ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-500'}`}>
                        {step.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{step.desc}</p>
                    </div>
                    {isActive && (
                      <div className="absolute right-3 w-1.5 h-1.5 bg-firebase-orange rounded-full animate-pulse"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto p-4 border-t border-white/5">
             <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center">
                    <Download className="w-3 h-3 mr-1" /> Auto-Deploy Script
                </h4>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleDownload(getScriptContent('win'), 'deploy.bat')}
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors ${previewOs === 'win' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                        onMouseEnter={() => setPreviewOs('win')}
                    >
                        Windows (.bat)
                    </button>
                    <button 
                        onClick={() => handleDownload(getScriptContent('unix'), 'deploy.sh')}
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors ${previewOs === 'unix' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                        onMouseEnter={() => setPreviewOs('unix')}
                    >
                        Mac/Linux (.sh)
                    </button>
                </div>
             </div>
          </div>
        </aside>

        {/* RIGHT: INTERACTIVE TERMINAL */}
        <section className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          
          {/* Header Bar */}
          <div className="h-10 bg-slate-900 border-b border-white/5 flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
              </div>
              <span className="ml-3 text-xs text-slate-500 font-mono flex items-center">
                <Terminal className="w-3 h-3 mr-1" />
                {guideMode === 'cicd' ? 'git-bash' : 'firebase-tools'} — {config.projectId || 'local'}
              </span>
            </div>
            {activeStepIndex < steps.length && (
              <div className="text-[10px] text-slate-500 animate-pulse">
                {guideMode === 'cicd' ? 'Waiting for Git command...' : 'Waiting for input...'}
              </div>
            )}
          </div>

          {/* Terminal Output Area */}
          <div className="flex-1 overflow-y-auto p-6 font-mono text-sm custom-scrollbar" onClick={() => inputRef.current?.focus()}>
            
            {/* Initial Welcome */}
            <div className="mb-6 text-slate-400">
               <div className="text-firebase-yellow mb-2">DoozeHost Assistant CLI v1.0.0</div>
               <div>Type the command below to proceed to step {activeStepIndex + 1}/{steps.length}.</div>
               <div className="text-slate-600 mt-1">Press [Tab] to auto-complete or click 'Skip' if done.</div>
            </div>

            {/* History */}
            {history.map((item, i) => (
              <div key={i} className="mb-4 break-words animate-in fade-in slide-in-from-left-2 duration-200">
                {item.type === 'command' && (
                   <div className="flex items-center text-slate-300">
                      <span className="text-green-500 mr-2">➜</span>
                      <span className="text-blue-400 mr-2">~/{config.projectId}</span>
                      <span className="text-white font-bold">{item.content}</span>
                   </div>
                )}
                {item.type === 'output' && (
                   <div className="mt-1 pl-4 border-l-2 border-slate-700 text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {item.content}
                   </div>
                )}
                {item.type === 'error' && (
                   <div className="mt-1 pl-4 border-l-2 border-red-500/50 text-red-400 whitespace-pre-wrap">
                      {item.content}
                   </div>
                )}
              </div>
            ))}

            {/* Current Active Input */}
            {!isFinished && (
               <div className="mt-4 animate-in fade-in">
                  
                  {/* Hint Bubble */}
                  <div className="mb-3 inline-flex items-center bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg">
                      <Zap className="w-3 h-3 text-firebase-yellow mr-2 animate-pulse" />
                      <span className="text-xs text-slate-300">
                        Run: <span className="font-bold text-white bg-black/30 px-1 rounded">{currentStep.command}</span>
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); skipStep(); }}
                        className="ml-4 text-[10px] text-slate-500 hover:text-white underline decoration-dotted"
                      >
                        Skip Step
                      </button>
                  </div>

                  <form onSubmit={handleCommandSubmit} className="flex items-center relative">
                      <span className="text-green-500 mr-2 text-lg">➜</span>
                      <span className="text-blue-400 mr-2">~/{config.projectId}</span>
                      <input 
                        ref={inputRef}
                        type="text" 
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-white font-bold placeholder-slate-700"
                        placeholder={currentStep.command}
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {isProcessing && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin absolute right-0" />}
                  </form>
               </div>
            )}

            {isFinished && (
               <div className="mt-8 p-6 bg-green-900/10 border border-green-500/20 rounded-xl text-center animate-in zoom-in duration-300">
                  <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Rocket className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Deployment Finished!</h3>
                  <p className="text-slate-400 text-sm mb-6">
                     {guideMode === 'cicd' 
                        ? 'Perubahan telah dipush. GitHub Actions sedang membangun situs Anda.' 
                        : 'Situs Anda seharusnya sudah online sekarang.'}
                  </p>
                  
                  <div className="flex justify-center gap-4">
                    <button onClick={() => { setActiveStepIndex(0); setHistory([]); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
                        Deploy Again
                    </button>
                    <a 
                        href={`https://${config.projectId || 'your-app'}.web.app`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-green-500/20 transition-all flex items-center"
                    >
                        Open Website <Monitor className="w-3 h-3 ml-2" />
                    </a>
                  </div>
               </div>
            )}
            
            <div ref={terminalEndRef} className="h-4"></div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GuideViewer;