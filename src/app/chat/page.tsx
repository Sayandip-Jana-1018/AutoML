"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import Aurora from "@/components/react-bits/Aurora"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/context/auth-context"
import { Send, Paperclip, Search, Sparkles, Server, Zap, FileText, Image as ImageIcon, Loader2, ChevronDown, Lock, Rocket, History, Plus, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, query, orderBy, onSnapshot, where, addDoc, updateDoc, doc, getDocs, serverTimestamp, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Model {
    id: string
    name: string
    type: string
    endpoint?: string
    latency: string
    algorithm?: string
    model_id?: string
    user_email?: string
    target_column?: string
    projectId?: string  // For linking to studio
}

interface Message {
    role: 'user' | 'assistant'
    content: string
    id: string
    createdAt?: any
}

interface ChatSession {
    id: string
    title: string
    lastMessage: string
    createdAt: any
    updatedAt: any
}


// Clean markdown and special characters from AI responses
function cleanMessage(text: string) {
    return text
        // Remove markdown bold/italic
        .replace(/\*\*\*/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/_/g, '')
        // Remove markdown headers
        .replace(/^#{1,6}\s+/gm, '')
        // Remove markdown lists
        .replace(/^\s*[-*+]\s+/gm, '• ')
        .replace(/^\s*\d+\.\s+/gm, (match) => match.replace(/\d+\./, (num) => `${num} `))
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        // Remove links but keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Clean up extra whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

export default function ChatPage() {
    const router = useRouter()
    const { themeColor, setThemeColor } = useThemeColor()
    const { user, userTier } = useAuth()

    const [attachedFiles, setAttachedFiles] = useState<File[]>([])
    const [researchMode, setResearchMode] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [mounted, setMounted] = useState(false)
    const [deployedModels, setDeployedModels] = useState<Model[]>([])
    const [executeLoading, setExecuteLoading] = useState<string | null>(null) // messageId being processed
    const genAiModelsData = [
        { id: "ai-3", name: "Gemini Pro", type: "ai", endpoint: "generativelanguage.googleapis.com", latency: "45ms", tier: 'free' as const },
        { id: "ai-1", name: "GPT-4 Turbo", type: "ai", endpoint: "api.openai.com/v1", latency: "24ms", tier: 'silver' as const },
        { id: "ai-2", name: "Claude 3 Opus", type: "ai", endpoint: "api.anthropic.com/v1", latency: "32ms", tier: 'gold' as const },
    ]
    const [genAiModels] = useState(genAiModelsData)
    const [selectedModel, setSelectedModel] = useState<Model>(genAiModelsData[0] as Model)
    const [loadingModels, setLoadingModels] = useState(true)

    // Chat history state
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [showHistory, setShowHistory] = useState(false)

    // Tier access check - same logic as studio page
    const canAccessModel = (modelTier: 'free' | 'silver' | 'gold') => {
        if (modelTier === 'free') return true
        if (modelTier === 'silver') return userTier === 'silver' || userTier === 'gold'
        if (modelTier === 'gold') return userTier === 'gold'
        return false
    }

    // Check if message contains actionable ML suggestion
    const hasActionableSuggestion = (content: string) => {
        // Code blocks
        if (content.includes('```python') || content.includes('```py')) return true

        // ML improvement keywords
        const mlKeywords = [
            'feature engineering', 'data cleaning', 'hyperparameter',
            'cross-validation', 'train_test_split', 'normalize', 'scale',
            'remove outliers', 'handle missing', 'encode categorical',
            'accuracy', 'precision', 'recall', 'f1', 'confusion matrix',
            'random forest', 'xgboost', 'gradient boosting', 'neural network',
            'epochs', 'learning rate', 'batch size', 'regularization'
        ]

        const lowerContent = content.toLowerCase()
        return mlKeywords.some(kw => lowerContent.includes(kw))
    }

    // Handle Execute in Studio button click
    const handleExecuteInStudio = async (messageContent: string, messageId: string, generateCode: boolean = false) => {
        if (!user?.uid || !user?.email) return

        // Get project ID from selected model or localStorage
        const projectId = selectedModel.projectId || localStorage.getItem('lastProjectId')

        if (!projectId) {
            alert('No project found. Please select a model linked to a project or create a new project in Studio.')
            return
        }

        setExecuteLoading(messageId)

        try {
            // If generateCode is true, first ask GenAI to generate implementation code
            let finalSuggestion = messageContent

            if (generateCode && !messageContent.includes('```python')) {
                // Call GenAI to generate implementation code from the suggestion
                const genRes = await fetch('/api/studio/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        message: `Based on this suggestion, generate the exact Python code to implement it. Only output the code, no explanations:

Suggestion: ${messageContent}

Model context:
- Algorithm: ${selectedModel.algorithm || 'Unknown'}
- Target: ${selectedModel.target_column || 'Unknown'}
- Name: ${selectedModel.name}`,
                        model: 'gemini'
                    })
                })

                if (genRes.ok) {
                    const genData = await genRes.json()
                    if (genData.updatedScript) {
                        finalSuggestion = genData.updatedScript
                    } else if (genData.responseMessage) {
                        finalSuggestion = `${messageContent}\n\n### Generated Implementation:\n\`\`\`python\n${genData.responseMessage}\n\`\`\``
                    }
                }
            }

            // Store suggestion server-side
            const res = await fetch('/api/studio/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    suggestion: finalSuggestion,
                    modelId: selectedModel.id,
                    userId: user.uid,
                    userEmail: user.email,
                    generateCode // Flag to indicate if code was auto-generated
                })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to store suggestion')
            }

            const { suggestionId } = await res.json()

            // Redirect to studio with suggestionId
            router.push(`/studio/${projectId}?suggestionId=${suggestionId}`)
        } catch (error) {
            console.error('Execute in Studio error:', error)
            alert(error instanceof Error ? error.message : 'Failed to execute in studio')
        } finally {
            setExecuteLoading(null)
        }
    }

    // Custom chat state management
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        const userMessage = { role: 'user' as const, content: input, id: Date.now().toString() }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            // Create or use existing session
            let sessionId = currentSessionId
            if (!sessionId && user?.email) {
                sessionId = await createNewSession(input)
            }

            // Save user message to Firestore
            if (sessionId) {
                await saveMessageToFirestore(userMessage, sessionId)
            }

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
                    modelId: selectedModel.id
                })
            })

            if (!res.ok) throw new Error('Failed to get response')

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let assistantMessage = ''
            const assistantId = (Date.now() + 1).toString()

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    assistantMessage += chunk

                    setMessages(prev => {
                        const newMessages = [...prev]
                        const lastMessage = newMessages[newMessages.length - 1]
                        if (lastMessage?.id === assistantId) {
                            lastMessage.content = assistantMessage
                        } else {
                            newMessages.push({ role: 'assistant', content: assistantMessage, id: assistantId })
                        }
                        return newMessages
                    })
                }

                // Save assistant response to Firestore
                if (sessionId) {
                    await saveMessageToFirestore({ role: 'assistant', content: assistantMessage, id: assistantId }, sessionId)
                }
            }
        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', id: Date.now().toString() }])
        } finally {
            setIsLoading(false)
        }
    }

    // Set default theme color to Pink on mount
    useEffect(() => {
        setThemeColor("#E947F5")
    }, [setThemeColor])

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    // Load chat sessions from Firestore
    useEffect(() => {
        if (!user?.email) return

        const sessionsRef = collection(db, 'chat_sessions')
        const q = query(
            sessionsRef,
            where('userEmail', '==', user.email),
            orderBy('updatedAt', 'desc'),
            limit(20)
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ChatSession[]
            setChatSessions(sessions)
        }, (err) => {
            console.error('Error fetching chat sessions:', err)
        })

        return () => unsubscribe()
    }, [user?.email])

    // Save message to Firestore
    const saveMessageToFirestore = async (msg: Message, sessionId: string) => {
        if (!user?.email) return

        try {
            await addDoc(collection(db, 'chat_sessions', sessionId, 'messages'), {
                role: msg.role,
                content: msg.content,
                createdAt: serverTimestamp()
            })

            // Update session's last message
            await updateDoc(doc(db, 'chat_sessions', sessionId), {
                lastMessage: msg.content.substring(0, 100),
                updatedAt: serverTimestamp()
            })
        } catch (err) {
            console.error('Error saving message:', err)
        }
    }

    // Create new chat session
    const createNewSession = async (firstMessage: string): Promise<string> => {
        if (!user?.email) return ''

        try {
            const sessionRef = await addDoc(collection(db, 'chat_sessions'), {
                userEmail: user.email,
                title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
                lastMessage: firstMessage.substring(0, 100),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })
            setCurrentSessionId(sessionRef.id)
            return sessionRef.id
        } catch (err) {
            console.error('Error creating session:', err)
            return ''
        }
    }

    // Load messages for a specific session
    const loadSessionMessages = async (sessionId: string) => {
        try {
            const messagesRef = collection(db, 'chat_sessions', sessionId, 'messages')
            const q = query(messagesRef, orderBy('createdAt', 'asc'))
            const snapshot = await getDocs(q)

            const msgs = snapshot.docs.map((doc, i) => ({
                id: doc.id,
                role: doc.data().role as 'user' | 'assistant',
                content: doc.data().content
            }))

            setMessages(msgs)
            setCurrentSessionId(sessionId)
            setShowHistory(false)
        } catch (err) {
            console.error('Error loading session messages:', err)
        }
    }

    // Start new chat
    const startNewChat = () => {
        setMessages([])
        setCurrentSessionId(null)
        setShowHistory(false)
    }

    // Fetch deployed models from Firestore
    useEffect(() => {
        if (!user) return

        setLoadingModels(true)

        // Fetch all models then filter client-side by multiple owner fields
        const modelsRef = collection(db, "models")
        const unsubscribe = onSnapshot(modelsRef, (snapshot) => {
            let modelsList = snapshot.docs.map(doc => {
                const data = doc.data()
                // Better name fallback: check multiple fields
                const modelName = data.name
                    || data.modelName
                    || data.displayName
                    || (data.target_column ? `${data.target_column} Model` : null)
                    || (data.projectName ? `${data.projectName}` : null)
                    || 'Trained Model'

                // Better algorithm fallback: check multiple fields
                const algorithm = data.taskType
                    || data.algorithm
                    || data.modelType
                    || data.model_type
                    || data.type
                    || 'ML Model'

                return {
                    model_id: doc.id,
                    name: modelName,
                    type: "ml",
                    algorithm: algorithm,
                    model_id_: doc.id,
                    latency: "N/A",
                    projectId: data.projectId,
                    target_column: data.target_column,
                    updatedAt: data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
                    ownerId: data.ownerId,
                    userId: data.userId,
                    owner_email: data.owner_email,
                    ownerEmail: data.ownerEmail,
                    user_email: data.user_email
                }
            })

            // Filter by multiple owner fields
            modelsList = modelsList.filter((m: any) =>
                m.ownerId === user?.uid ||
                m.userId === user?.uid ||
                m.owner_email === user?.email ||
                m.ownerEmail === user?.email ||
                m.user_email === user?.email
            )

            // Sort client-side
            modelsList.sort((a: any, b: any) => (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0))

            const mlModels = modelsList.map((m: any, idx: number) => ({
                id: `ml-${idx}`,
                name: m.name,
                type: "ml",
                algorithm: m.algorithm,
                model_id: m.model_id,
                latency: "N/A",
                projectId: m.projectId
            }))

            setDeployedModels(mlModels)
            setLoadingModels(false)
        }, (err) => {
            console.error("Error fetching models:", err)
            setDeployedModels([])
            setLoadingModels(false)
        })

        return () => unsubscribe()
    }, [user])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(Array.from(e.target.files))
        }
    }

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Memoize Background component to prevent re-renders
    const backgroundElement = useMemo(() => {
        if (!mounted) return null
        if (typeof document === 'undefined') return null

        const { createPortal } = require('react-dom')
        return createPortal(
            <div className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 30 }}>
                <Aurora
                    colorStops={[themeColor, "#000000", themeColor]}
                    speed={0.5}
                    amplitude={1.2}
                />
            </div>,
            document.body
        )
    }, [mounted, themeColor])

    return (
        <>
            {backgroundElement}
            <div className="flex h-screen text-white overflow-y-auto font-sans selection:bg-pink-500/30 relative z-40">
                <div className="fixed top-0 right-0 z-[60]"><ThemeToggle /></div>
                <div className="relative z-50"><Navbar /></div>

                <main className="relative z-10 min-h-screen flex flex-col items-center justify-start p-6 mt-16 overflow-y-hidden w-full">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto mb-12 text-center">
                        <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-2xl">
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">Let's Chat</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
                            Connect with AI models and collaborate seamlessly
                        </p>
                    </motion.div>

                    <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 h-[600px] overflow-y-auto">
                            {/* Sidebar Tabs */}
                            <div className="flex items-center gap-2 mb-4">
                                <button
                                    onClick={() => setShowHistory(false)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all",
                                        !showHistory ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
                                    )}
                                    style={{ color: !showHistory ? themeColor : 'rgba(255,255,255,0.6)' }}
                                >
                                    <Server className="w-4 h-4" />
                                    Models
                                </button>
                                <button
                                    onClick={() => setShowHistory(true)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all",
                                        showHistory ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
                                    )}
                                    style={{ color: showHistory ? themeColor : 'rgba(255,255,255,0.6)' }}
                                >
                                    <History className="w-4 h-4" />
                                    History
                                </button>
                            </div>

                            {showHistory ? (
                                /* Chat History View */
                                <div className="space-y-3">
                                    <button
                                        onClick={startNewChat}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all hover:scale-105"
                                        style={{ background: themeColor, color: 'white' }}
                                    >
                                        <Plus className="w-4 h-4" />
                                        New Chat
                                    </button>

                                    <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 px-2 mt-4">Recent Chats</div>

                                    {chatSessions.length === 0 ? (
                                        <div className="text-white/40 text-sm px-2 italic text-center py-8">
                                            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            No chat history yet
                                        </div>
                                    ) : (
                                        chatSessions.map((session) => (
                                            <button
                                                key={session.id}
                                                onClick={() => loadSessionMessages(session.id)}
                                                className={cn(
                                                    "w-full p-3 rounded-xl text-left transition-all border",
                                                    currentSessionId === session.id
                                                        ? "bg-white/20 border-2"
                                                        : "bg-white/5 border-white/10 hover:bg-white/10"
                                                )}
                                                style={{
                                                    borderColor: currentSessionId === session.id ? themeColor : undefined
                                                }}
                                            >
                                                <div className="font-bold text-white text-sm truncate">{session.title}</div>
                                                <div className="text-xs text-white/40 truncate mt-1">{session.lastMessage}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            ) : (
                                /* Models View */
                                <>
                                    {loadingModels ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 px-2">Your Trained Models</div>
                                            {deployedModels.length === 0 ? (
                                                <div className="text-white/40 text-sm px-2 italic">No trained models found.</div>
                                            ) : (
                                                deployedModels.map((model) => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => { setSelectedModel(model); setMessages([]) }}
                                                        className={cn(
                                                            "w-full p-4 rounded-2xl text-left transition-all border",
                                                            selectedModel.id === model.id
                                                                ? "bg-white/20 border-2"
                                                                : "bg-white/5 border-white/10 hover:bg-white/10"
                                                        )}
                                                        style={{
                                                            borderColor: selectedModel.id === model.id ? themeColor : undefined,
                                                            boxShadow: selectedModel.id === model.id ? `0 0 15px ${themeColor}20` : undefined
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="font-bold text-white text-sm" style={{ color: selectedModel.id === model.id ? themeColor : 'white' }}>{model.name}</div>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">ML</span>
                                                        </div>
                                                        <div className="text-xs text-white/40 flex items-center gap-2">
                                                            <Zap className="w-3 h-3" style={{ color: selectedModel.id === model.id ? themeColor : undefined }} />
                                                            {model.algorithm}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl flex flex-col h-[600px]">
                            <div className="p-6 border-b border-white/20 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{selectedModel?.name || 'Select a Model'}</h3>
                                        <p className="text-xs text-white/40">Connected • {selectedModel?.latency || 'Ready'}</p>
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-medium text-white">
                                            <span>Gen AI Models</span>
                                            <ChevronDown className="w-4 h-4 opacity-50" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 bg-black/90 border-white/10 backdrop-blur-xl text-white">
                                        {genAiModels.map((model: any) => {
                                            const isLocked = !canAccessModel(model.tier)
                                            return (
                                                <DropdownMenuItem
                                                    key={model.id}
                                                    onClick={() => {
                                                        if (!isLocked) {
                                                            setSelectedModel(model)
                                                            setMessages([])
                                                        }
                                                    }}
                                                    className={cn(
                                                        "cursor-pointer focus:bg-white/10 focus:text-white gap-2",
                                                        selectedModel.id === model.id && "bg-white/10",
                                                        isLocked && "opacity-50 pointer-events-none"
                                                    )}
                                                >
                                                    {isLocked ? (
                                                        <Lock className="w-4 h-4 text-white/40" />
                                                    ) : (
                                                        <Sparkles className="w-4 h-4" style={{ color: themeColor }} />
                                                    )}
                                                    <div className="flex flex-col flex-1">
                                                        <span className="font-medium">{model.name}</span>
                                                        <span className="text-[10px] text-white/40">{model.latency}</span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                                                        model.tier === 'free' && "bg-green-500/20 text-green-400",
                                                        model.tier === 'silver' && "bg-gray-400/20 text-gray-300",
                                                        model.tier === 'gold' && "bg-yellow-500/20 text-yellow-400"
                                                    )}>
                                                        {model.tier}
                                                    </span>
                                                </DropdownMenuItem>
                                            )
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 && (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-center">
                                            <Sparkles className="w-12 h-12 text-white/40 mx-auto mb-4" />
                                            <p className="text-white/40">Start chatting with {selectedModel?.name || 'AI'}</p>
                                        </div>
                                    </div>
                                )}

                                <AnimatePresence>
                                    {messages.map((msg) => (
                                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: msg.role === "user" ? themeColor : 'rgba(255,255,255,0.2)' }}>
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <div className={cn("max-w-md px-4 py-3 rounded-2xl", msg.role === "user" ? "bg-white/20 border border-white/30" : "bg-white/10 border border-white/20")}>
                                                    <p className="text-sm text-white whitespace-pre-wrap">{cleanMessage(msg.content)}</p>
                                                </div>
                                                {/* Action buttons for AI messages with actionable suggestions */}
                                                {msg.role === "assistant" && hasActionableSuggestion(msg.content) && (
                                                    <div className="flex gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => handleExecuteInStudio(msg.content, msg.id, false)}
                                                            disabled={executeLoading === msg.id}
                                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50"
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
                                                                border: `1px solid ${themeColor}50`,
                                                                backdropFilter: 'blur(8px)',
                                                                color: themeColor
                                                            }}
                                                        >
                                                            {executeLoading === msg.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Rocket className="w-4 h-4" />
                                                            )}
                                                            View in Studio
                                                        </button>
                                                        <button
                                                            onClick={() => handleExecuteInStudio(msg.content, msg.id, true)}
                                                            disabled={executeLoading === msg.id}
                                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50"
                                                            style={{
                                                                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                                                                border: `1px solid ${themeColor}`,
                                                                color: 'white'
                                                            }}
                                                        >
                                                            {executeLoading === msg.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Zap className="w-4 h-4" />
                                                            )}
                                                            Apply & Retrain
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/20">
                                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                                        </div>
                                        <div className="bg-white/10 border border-white/20 px-4 py-3 rounded-2xl">
                                            <p className="text-sm text-white/60">Thinking...</p>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-6 border-t border-white/20">
                                {attachedFiles.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {attachedFiles.map((file, i) => (
                                            <div key={i} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white/80 flex items-center gap-2">
                                                {file.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" style={{ color: themeColor }} /> : <FileText className="w-3 h-3" style={{ color: themeColor }} />}
                                                {file.name}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="flex items-center gap-3">
                                    <div className={cn("flex-1 flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all", researchMode ? "bg-white/20 border-white/40" : "bg-white/10 border-white/20")}>
                                        <Search className="w-5 h-5 text-white/40" />
                                        <input type="text" value={input} onChange={handleInputChange} placeholder="Ask anything..." className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40" />
                                    </div>

                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all">
                                        <Paperclip className="w-5 h-5 text-white/60" />
                                    </button>
                                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

                                    <button type="submit" disabled={!input.trim() || isLoading} className="px-6 py-3 rounded-2xl font-bold text-white transition-all hover:brightness-110 disabled:opacity-50" style={{ background: themeColor }}>
                                        <Send className="w-5 h-5" />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                </main>
            </div>
        </>
    )
}
