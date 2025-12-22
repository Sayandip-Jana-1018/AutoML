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
    currentScriptVersion?: number;
    currentVersionId?: string;
    datasetType?: string;
    schema?: any;
    themeColor: string;
    /** Optional message to send programmatically (e.g., from fix validation errors button) */
    externalMessage?: string | null;
    /** Callback when external message has been processed */
    onExternalMessageSent?: () => void;
    /** Dataset info for context (filename, columns, rows, etc.) */
    datasetInfo?: {
        filename?: string;
        columns?: string[];
        rows?: number;
        taskType?: string;
        targetColumn?: string;
    };
}

export const ChatInterface = ({
    projectId,
    currentScript,
    currentScriptVersion,
    currentVersionId,
    datasetType,
    schema,
    themeColor,
    externalMessage,
    onExternalMessageSent,
    datasetInfo
}: ChatInterfaceProps) => {
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
        const savedModel = localStorage.getItem('mlforge_selected_model') as 'gemini' | 'openai' | 'claude' | null;
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

    // Handle external message (e.g., from "Fix with AI" button)
    useEffect(() => {
        if (externalMessage && !sending && user) {
            handleSend(externalMessage);
            onExternalMessageSent?.();
        }
    }, [externalMessage]);

    const handleSend = async (messageOverride?: string) => {
        const messageToSend = messageOverride || input;
        if (!messageToSend.trim() || sending || !user) return;
        setSending(true);

        try {
            await addDoc(collection(db, 'projects', projectId, 'messages'), {
                role: 'user',
                content: messageToSend,
                createdAt: serverTimestamp(),
                user_email: user.email
            });
            if (!messageOverride) setInput('');

            const res = await fetch('/api/studio/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    message: messageToSend,
                    currentScript,
                    currentScriptVersion,
                    currentVersionId,
                    datasetType,
                    model: selectedModel,
                    schema,
                    tier: userTier || 'free',
                    // Include dataset info for better context
                    datasetInfo: datasetInfo ? {
                        filename: datasetInfo.filename,
                        columns: datasetInfo.columns,
                        rows: datasetInfo.rows,
                        taskType: datasetInfo.taskType,
                        targetColumn: datasetInfo.targetColumn
                    } : undefined,
                    // INCLUDE HISTORY
                    history: messages.map(m => ({ role: m.role, content: m.content }))
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
            <div className="p-2 md:p-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
                <div className="text-[10px] md:text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-bold flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
                    <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: themeColor }} />
                    <span className="hidden sm:inline">AI Orchestrator</span>
                    <span className="sm:hidden">AI</span>
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
                                localStorage.setItem('mlforge_selected_model', value);
                            }
                        }}
                        className="appearance-none bg-white/40 dark:bg-black/40 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-[11px] font-medium focus:outline-none cursor-pointer transition-all hover:bg-white/60 dark:hover:bg-black/60"
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
                            {modelAccess.claude ? 'Claude 3.5 Opus (Gold)' : '🔒 Claude 3.5 (Gold)'}
                        </option>
                    </select>
                </div>
            </div>

            {/* Chat Messages - Fixed height with themed scrollbar */}
            <style dangerouslySetInnerHTML={{
                __html: `
                #chat-messages-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                #chat-messages-scroll::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 3px;
                }
                #chat-messages-scroll::-webkit-scrollbar-thumb {
                    background: ${themeColor}40;
                    border-radius: 3px;
                }
                #chat-messages-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${themeColor}80;
                }
            `}} />
            <div
                id="chat-messages-scroll"
                className="flex-1 min-h-0 p-3 md:p-4 space-y-3 md:space-y-4 overflow-auto"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${themeColor}40 rgba(0,0,0,0.2)`,
                }}
            >
                {messages.length === 0 && (
                    <div className="text-center text-black/30 dark:text-white/30 text-sm mt-10">
                        <p>Tell me how to change your model.</p>
                        <p className="text-xs mt-2">"Add dropout layer"</p>
                        <p className="text-xs">"Split 80/20"</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div
                            className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm backdrop-blur-sm ${msg.role === 'user'
                                ? 'text-white'
                                : 'bg-white/40 dark:bg-white/5 text-black/80 dark:text-white/90 border border-black/5 dark:border-white/10'
                                }`}
                            style={msg.role === 'user' ? {
                                background: `linear-gradient(135deg, ${themeColor}50 0%, ${themeColor}30 100%)`,
                                border: `1px solid ${themeColor}40`,
                                boxShadow: `0 2px 12px ${themeColor}20`
                            } : undefined}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {sending && (
                    <div className="flex items-start">
                        <div
                            className="rounded-2xl px-4 py-2.5 flex items-center gap-2 backdrop-blur-sm"
                            style={{
                                background: `linear-gradient(135deg, ${themeColor}20 0%, ${themeColor}10 100%)`,
                                border: `1px solid ${themeColor}30`
                            }}
                        >
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: themeColor }} />
                            <span className="text-xs text-black/70 dark:text-white/70">Generating code...</span>
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            <div className="p-3 md:p-4 border-t border-black/10 dark:border-white/10">
                <div className="flex gap-2">
                    <button
                        onClick={toggleVoice}
                        className={`p-2 md:p-2.5 rounded-lg transition-all duration-300 min-w-[40px] min-h-[40px] flex items-center justify-center ${isListening
                            ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/50'
                            : 'bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white border border-black/10 dark:border-white/10'
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
                        className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 md:px-3 py-1.5 md:py-2.5 text-black dark:text-white text-xs md:text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30 min-h-[36px] md:min-h-[44px]"
                        disabled={sending}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={sending || !input.trim()}
                        style={{ backgroundColor: themeColor }}
                        className={`hover:brightness-110 disabled:opacity-50 px-3 md:px-4 py-1.5 md:py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all min-w-[50px] md:min-w-[60px] min-h-[36px] md:min-h-[44px] ${['#ffffff', '#00ffff', '#f59e0b', '#84cc16', '#FEBC2E'].includes(themeColor) ? 'text-black' : 'text-white'
                            }`}
                    >
                        Send
                    </button>
                </div>
            </div>
        </GlassCard>
    );
};

export default ChatInterface;
