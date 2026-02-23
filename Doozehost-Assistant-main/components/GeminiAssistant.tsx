import React, { useState, useRef, useEffect } from 'react';
import { ProjectConfig, ChatMessage } from '../types';
import { getGeminiResponse } from '../services/geminiService';
import { Send, X, Bot, Loader2, Minimize2, Sparkles } from 'lucide-react';

interface Props {
  config: ProjectConfig;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  initialMessage: string | null;
  clearInitialMessage: () => void;
}

const GeminiAssistant: React.FC<Props> = ({ config, isOpen, setIsOpen, initialMessage, clearInitialMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: 'Halo! Saya asisten AI DoozeHost. Ada kendala deployment?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOpen]);
  useEffect(() => {
    if (isOpen && initialMessage) {
      setInput(initialMessage);
      clearInitialMessage();
    }
  }, [isOpen, initialMessage, clearInitialMessage]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const responseText = await getGeminiResponse(userMsg.text, config, history);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: responseText }]);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 group z-50 animate-bounce-slow"
        aria-label="Ask AI"
      >
        <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
        <div className="relative w-14 h-14 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl border border-white/20 transition-transform group-hover:scale-110">
           <Bot className="w-7 h-7 text-white" />
           <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-96 md:h-[600px] md:max-h-[85vh] flex flex-col bg-slate-900 md:border md:border-white/10 md:rounded-2xl shadow-2xl z-50 overflow-hidden font-sans animate-in slide-in-from-bottom-10 duration-300 ring-1 ring-white/10 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-white/5 shrink-0">
        <div className="flex items-center">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-400 p-1.5 rounded-lg mr-3 shadow-lg shadow-blue-500/20">
             <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide">AI Architect</h3>
            <p className="text-blue-400 text-[10px] font-mono uppercase tracking-widest">Online</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition">
          {window.innerWidth < 768 ? <Minimize2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-950/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-200 border border-white/5 rounded-bl-none'
              }`}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-slate-800 border border-white/5 rounded-2xl rounded-bl-none px-4 py-3 flex items-center">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin mr-2" />
                <span className="text-slate-400 text-xs animate-pulse">Thinking...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-slate-900 border-t border-white/5 shrink-0 pb-safe">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pertanyaan..."
            className="w-full pl-4 pr-12 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-12 text-sm transition-all"
            rows={1}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:bg-slate-700 transition-all shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiAssistant;