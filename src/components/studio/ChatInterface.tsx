'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Mic, MicOff, Loader2 } from 'lucide-react';
import { collection, addDoc, orderBy, query, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { GlassCard } from './GlassCard';
import { Message } from './types';

interface ChatInterfaceProps {
    projectId: string;
    currentScript: string;
    datasetType?: string;
    schema?: any;
    themeColor: string;
}

export const ChatInterface = ({ projectId, currentScript, datasetType, schema, themeColor }: ChatInterfaceProps) => {
    const { user, userTier } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'gemini' | 'openai' | 'claude'>('gemini');
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // Model availability based on tier
    const modelAccess = {
        gemini: true, // Available to all tiers
        openai: userTier === 'silver' || userTier === 'gold', // Silver+
        claude: userTier === 'gold' // Gold only
    };

    // Load saved model from localStorage on mount
    useEffect(() => {
        const savedModel = localStorage.getItem('adhyay_selected_model') as 'gemini' | 'openai' | 'claude' | null;
        if (savedModel && modelAccess[savedModel]) {
            setSelectedModel(savedModel);
        }
    }, [userTier]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.lang = 'en-US';
                recognition.interimResults = false;

                recognition.onstart = () => setIsListening(true);
                recognition.onend = () => setIsListening(false);
                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setInput(prev => prev ? prev + ' ' + transcript : transcript);
                };
                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };

    useEffect(() => {
        const q = query(
            collection(db, 'projects', projectId, 'messages'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsubscribe();
    }, [projectId]);

    const handleSend = async () => {
        if (!input.trim() || sending || !user) return;
        setSending(true);

        try {
            await addDoc(collection(db, 'projects', projectId, 'messages'), {
                role: 'user',
                content: input,
                createdAt: serverTimestamp(),
                user_email: user.email
            });
            setInput('');

            const res = await fetch('/api/studio/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    message: input,
                    currentScript,
                    datasetType,
                    model: selectedModel,
                    schema,
                    tier: userTier || 'free' // Pass user tier for resource limits
                })
            });

            if (!res.ok) throw new Error("AI Processing Failed");

            const data = await res.json();

            if (data.updatedScript) {
                await updateDoc(doc(db, 'projects', projectId), {
                    currentScript: data.updatedScript,
                    lastUpdated: serverTimestamp()
                });
            }

            await addDoc(collection(db, 'projects', projectId, 'messages'), {
                role: 'assistant',
                content: data.responseMessage || "I've updated the code.",
                createdAt: serverTimestamp()
            });

        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    return (
        <GlassCard className="flex flex-col h-full overflow-hidden" hover={false}>
            <div className="p-3 border-b border-white/10 dark:border-white/10 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" style={{ color: themeColor }} /> AI Orchestrator
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full" style={{
                        backgroundColor: `${themeColor}20`,
                        color: themeColor
                    }}>
                        {userTier}
                    </span>
                    <select
                        value={selectedModel}
                        onChange={(e) => {
                            const value = e.target.value as 'gemini' | 'openai' | 'claude';
                            if (modelAccess[value]) {
                                setSelectedModel(value);
                                localStorage.setItem('adhyay_selected_model', value);
                            }
                        }}
                        className="appearance-none bg-black/40 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-[11px] font-medium focus:outline-none cursor-pointer transition-all hover:bg-black/60"
                        style={{
                            borderColor: `${themeColor}50`,
                            color: themeColor,
                            boxShadow: `0 0 10px ${themeColor}20`
                        }}
                    >
                        <option value="gemini" className="bg-[#1a1a1a] text-cyan-400">
                            Gemini 2.0 Flash (Free)
                        </option>
                        <option
                            value="openai"
                            className="bg-[#1a1a1a] text-green-400"
                            disabled={!modelAccess.openai}
                        >
                            {modelAccess.openai ? 'GPT-4o (Silver)' : '🔒 GPT-4o (Silver)'}
                        </option>
                        <option
                            value="claude"
                            className="bg-[#1a1a1a] text-purple-400"
                            disabled={!modelAccess.claude}
                        >
                            {modelAccess.claude ? 'Claude 3.5 Sonnet (Gold)' : '🔒 Claude 3.5 (Gold)'}
                        </option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-black/30 dark:text-white/30 text-sm mt-10">
                        <p>Tell me how to change your model.</p>
                        <p className="text-xs mt-2">"Add dropout layer"</p>
                        <p className="text-xs">"Split 80/20"</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] rounded-xl p-3 text-sm ${msg.role === 'user'
                            ? 'bg-blue-600/20 text-blue-100 border border-blue-600/30'
                            : 'bg-white/10 dark:bg-white/10 text-black dark:text-gray-200 border border-white/10 dark:border-white/10'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className="flex items-start">
                        <div className="bg-white/10 dark:bg-white/10 rounded-xl p-3 flex items-center gap-2 border border-white/10 dark:border-white/10">
                            <Loader2 className="w-4 h-4 animate-spin text-black/50 dark:text-white/50" />
                            <span className="text-xs text-black/50 dark:text-white/50">Processing code changes...</span>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            <div className="p-4 border-t border-white/10 dark:border-white/10">
                <div className="flex gap-2">
                    <button
                        onClick={toggleVoice}
                        className={`p-2 rounded-lg transition-all duration-300 ${isListening
                            ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/50'
                            : 'bg-white/5 dark:bg-white/5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white border border-white/10 dark:border-white/10'
                            }`}
                        title="Voice Command"
                    >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder={isListening ? "Listening..." : "Type instruction..."}
                        className="flex-1 bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 rounded-lg px-3 py-2 text-black dark:text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30"
                        disabled={sending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={sending || !input.trim()}
                        style={{ backgroundColor: themeColor }}
                        className="hover:brightness-110 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                    >
                        Send
                    </button>
                </div>
            </div>
        </GlassCard>
    );
};

export default ChatInterface;
