"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import Aurora from "@/components/react-bits/Aurora"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/context/auth-context"
import { Send, Paperclip, Search, Sparkles, Server, Zap, FileText, Image as ImageIcon, Loader2, ChevronDown, Lock, Rocket, History, Plus, MessageCircle, Trash2, Database, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { collection, query, orderBy, onSnapshot, where, addDoc, updateDoc, doc, getDocs, getDoc, deleteDoc, serverTimestamp, limit } from "firebase/firestore"
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
    metrics?: {
        accuracy?: number
        silhouette?: number
        r2?: number
        rmse?: number
    }
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
    projectId?: string  // For project-specific chat history
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
    const [loadingStep, setLoadingStep] = useState(0) // 0=idle, 1=fetching, 2=generating, 3=saving, 4=complete
    const genAiModelsData = [
        { id: "ai-3", name: "Gemini Pro", type: "ai", endpoint: "generativelanguage.googleapis.com", latency: "45ms", tier: 'free' as const, icon: 'sparkles' },
        { id: "ai-1", name: "GPT-4 Turbo", type: "ai", endpoint: "api.openai.com/v1", latency: "24ms", tier: 'silver' as const, icon: 'zap' },
        { id: "ai-2", name: "Claude 3 Opus", type: "ai", endpoint: "api.anthropic.com/v1", latency: "32ms", tier: 'gold' as const, icon: 'server' },
    ]
    const [genAiModels] = useState(genAiModelsData)
    const [selectedModel, setSelectedModel] = useState<Model>(genAiModelsData[0] as Model)
    const [loadingModels, setLoadingModels] = useState(true)

    // Chat history state
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null) // For smooth delete confirmation
    const [showModal, setShowModal] = useState(false) // For custom alert modal
    const [modalMessage, setModalMessage] = useState('')
    const [selectedProject, setSelectedProject] = useState<Model | null>(null) // For Studio context, separate from chat model
    const [datasetSchema, setDatasetSchema] = useState<{
        filename?: string;
        columns?: string[];
        columnTypes?: Record<string, string>;
        rowCount?: number;
        missingValues?: Record<string, number>;
        targetColumn?: string;
        qualityScore?: number;
    } | null>(null) // Dataset metadata for AI context
    const [projectHistoryContext, setProjectHistoryContext] = useState<string>('') // God-mode context for AI
    const [currentScript, setCurrentScript] = useState<string>('')

    // Tier access check - same logic as studio page
    const canAccessModel = (modelTier: 'free' | 'silver' | 'gold') => {
        if (modelTier === 'free') return true
        if (modelTier === 'silver') return userTier === 'silver' || userTier === 'gold'
        if (modelTier === 'gold') return userTier === 'gold'
        return false
    }

    // Fetch dataset schema when project is selected
    useEffect(() => {
        const fetchDatasetSchema = async () => {
            if (!selectedProject?.projectId) {
                setDatasetSchema(null)
                return
            }

            try {
                // Fetch newest dataset from project's datasets subcollection
                const datasetsRef = collection(db, 'projects', selectedProject.projectId, 'datasets')
                const datasetsQuery = query(datasetsRef, orderBy('createdAt', 'desc'), limit(1))
                const datasetsSnap = await getDocs(datasetsQuery)

                if (!datasetsSnap.empty) {
                    const newestDataset = datasetsSnap.docs[0].data()
                    const schema = newestDataset.schema || {}

                    // Build missing values map from schema
                    const missingValues: Record<string, number> = {}
                    if (schema.columnStats) {
                        Object.entries(schema.columnStats).forEach(([col, stats]: [string, any]) => {
                            if (stats.nullCount > 0) {
                                missingValues[col] = stats.nullCount
                            }
                        })
                    }

                    setDatasetSchema({
                        filename: newestDataset.filename || schema.filename || 'Dataset',
                        columns: schema.columns || newestDataset.columns || [],
                        columnTypes: schema.columnTypes || newestDataset.columnTypes || {},
                        rowCount: schema.rowCount || newestDataset.rowCount || 0,
                        missingValues,
                        targetColumn: schema.targetColumnSuggestion || newestDataset.targetColumn,
                        qualityScore: schema.qualityScore || 80
                    })
                    console.log('[Chat] Loaded dataset schema:', schema.columns?.length, 'columns')
                } else {
                    setDatasetSchema(null)
                }
            } catch (err) {
                console.error('[Chat] Error fetching dataset schema:', err)
                setDatasetSchema(null)
            }
        }

        fetchDatasetSchema()
    }, [selectedProject?.projectId])

    // Fetch full project history (jobs, scripts, best models) - 'God Mode' Context
    useEffect(() => {
        const fetchProjectHistory = async () => {
            if (!selectedProject?.projectId) {
                setProjectHistoryContext('')
                return
            }

            try {
                const projectId = selectedProject.projectId;
                let historyContext = `[PROJECT KNOWLEDGE BASE - ID: ${projectId}]\n\n`;

                // 1. Fetch Job History
                const jobsRef = collection(db, 'projects', projectId, 'jobs');
                const jobsQuery = query(jobsRef, orderBy('createdAt', 'desc'));
                const jobsSnap = await getDocs(jobsQuery);

                if (!jobsSnap.empty) {
                    const jobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                    const completedJobs = jobs.filter((j: any) => j.status === 'succeeded' || j.status === 'completed');

                    // Find best model
                    const bestJob = completedJobs.reduce((prev: any, current: any) => {
                        const prevAcc = prev?.metrics?.accuracy || 0;
                        const currAcc = current?.metrics?.accuracy || 0;
                        return (currAcc > prevAcc) ? current : prev;
                    }, completedJobs[0] || null);

                    historyContext += `### TRAINING RUNS (${jobs.length}):\n`;
                    jobs.slice(0, 10).forEach((job: any) => { // Recent 10 jobs
                        const acc = job.metrics?.accuracy ? (job.metrics.accuracy * 100).toFixed(1) + '%' : 'N/A';
                        const date = job.createdAt?.toDate ? new Date(job.createdAt.toDate()).toLocaleDateString() : 'Unknown Date';
                        historyContext += `- [${job.status}] ${job.algorithm || 'Unknown'} (v${job.scriptVersion || '?'}) | Acc: ${acc} | ${date}\n`;
                    });

                    if (bestJob) {
                        const bestAcc = bestJob.metrics?.accuracy ? (bestJob.metrics.accuracy * 100).toFixed(1) + '%' : 'N/A';
                        historyContext += `\n🏆 CHAMPION MODEL: ${bestJob.algorithm} (v${bestJob.scriptVersion})\n   • Accuracy: ${bestAcc}\n   • Loss: ${bestJob.metrics?.loss?.toFixed(4) || 'N/A'}\n   • Best Features: ${JSON.stringify(bestJob.config?.features || 'All')}\n`;
                    }
                } else {
                    historyContext += `No completed training runs found yet.\n`;
                }

                // 2. Fetch Current Script
                const projectDoc = await getDoc(doc(db, 'projects', projectId));
                if (projectDoc.exists()) {
                    const data = projectDoc.data();
                    const script = data.currentScript || data.script;
                    if (script) {
                        historyContext += `\n### CURRENT ACTIVE KERNEL CODE:\n\`\`\`python\n${script.substring(0, 12000)}\n\`\`\`\n`;
                        setCurrentScript(script);
                    }
                }

                setProjectHistoryContext(historyContext);
                console.log('[Chat] Built God-Mode Context');

            } catch (err) {
                console.error('Error fetching project history:', err);
            }
        };

        fetchProjectHistory();
    }, [selectedProject?.projectId]);

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

        // Get project ID from selectedProject or localStorage
        const projectId = selectedProject?.projectId || localStorage.getItem('lastProjectId')

        if (!projectId) {
            setModalMessage('No project found. Please select a model linked to a project or create a new project in Studio.');
            setShowModal(true);
            return
        }

        setExecuteLoading(messageId)
        let generatedSummary: any = null // Store summary from studio/chat API

        try {
            setLoadingStep(1) // Step 1: Fetching data
            // Fetch dataset schema and current script from the project
            let datasetSchema = null;
            let currentScript = '';

            try {
                // Fetch newest dataset from project's datasets subcollection
                const datasetsRef = collection(db, 'projects', projectId, 'datasets');
                const datasetsQuery = query(datasetsRef, orderBy('createdAt', 'desc'));
                const datasetsSnap = await getDocs(datasetsQuery);

                if (!datasetsSnap.empty) {
                    const newestDataset = datasetsSnap.docs[0].data();
                    datasetSchema = newestDataset.schema || null;
                    console.log('[Chat] Fetched dataset schema:', datasetSchema?.columnCount, 'columns');
                }

                // Fetch current script from project doc
                const projectDoc = await getDocs(query(collection(db, 'projects'), where('__name__', '==', projectId)));
                if (!projectDoc.empty) {
                    const projectData = projectDoc.docs[0].data();
                    currentScript = projectData.currentScript || projectData.script || '';
                    console.log('[Chat] Fetched current script:', currentScript.substring(0, 100));
                }
            } catch (fetchErr) {
                console.error('[Chat] Error fetching dataset/script:', fetchErr);
                // Continue without schema - AI will use defaults
            }

            // If generateCode is true, first ask GenAI to generate implementation code
            let finalSuggestion = messageContent

            if (generateCode) {
                setLoadingStep(2) // Step 2: Generating code
                // Map selectedModel ID to studio API model name
                const modelMap: Record<string, string> = {
                    'ai-2': 'claude',
                    'ai-1': 'openai',
                    'ai-3': 'gemini'
                };
                const studioModel = modelMap[selectedModel.id] || 'gemini';

                // Build comprehensive prompt for COMPLETE NEW VERSION
                const codeGenPrompt = `You are a Senior ML Engineer. Generate a COMPLETELY NEW and IMPROVED Python ML training script.

REFERENCE SCRIPT (for structure and context only):
\`\`\`python
${currentScript}
\`\`\`

USER'S IMPROVEMENT REQUESTS (implement ALL of these):
${messages.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n---\n')}

LATEST INSTRUCTION: ${messageContent}

CRITICAL REQUIREMENTS:
1. Generate a BRAND NEW COMPLETE SCRIPT from scratch
2. Implement ALL the improvements discussed in the chat
3. Include ALL necessary imports at the top
4. Include ALL functions: load_data, preprocess, train_model, evaluate, save_model
5. Include the main() function and if __name__ == "__main__" block
6. The script must be 100% complete and immediately runnable
7. NO placeholders like "...", NO comments like "rest of code", NO "same as before"
8. This is NOT a modification - it's a complete rewrite with improvements

OUTPUT FORMAT:
Return ONLY the complete Python script. No explanations, no markdown headers, just pure Python code.`;

                // Call GenAI to generate implementation code
                const genRes = await fetch('/api/studio/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        message: codeGenPrompt,
                        model: studioModel,
                        currentScript: currentScript,
                        datasetInfo: datasetSchema ? {
                            filename: datasetSchema.filename,
                            columns: datasetSchema.columns,
                            rows: datasetSchema.rowCount,
                            targetColumn: datasetSchema.targetColumn
                        } : undefined,
                        history: messages.map(m => ({ role: m.role, content: m.content }))
                    })
                })

                if (genRes.ok) {
                    const genData = await genRes.json()
                    // Store summary if generated by studio chat
                    if (genData.summary) {
                        generatedSummary = genData.summary
                    }
                    if (genData.updatedScript) {
                        // Use AI-generated script directly - no fallbacks
                        finalSuggestion = `### AI Generated Code:\n\`\`\`python\n${genData.updatedScript}\n\`\`\``
                        console.log('[Chat] AI script received, length:', genData.updatedScript.length);
                    }
                }
            }

            // Store suggestion server-side
            setLoadingStep(3) // Step 3: Saving to Studio
            const res = await fetch('/api/studio/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    suggestion: finalSuggestion,
                    modelId: selectedModel.id,
                    modelType: selectedModel.id, // Pass model ID (ai-1, ai-2, ai-3)
                    modelName: selectedModel.name, // Pass model name for display
                    userId: user.uid,
                    userEmail: user.email,
                    generateCode, // Flag to indicate if code was auto-generated
                    summary: generatedSummary, // Pass pre-generated summary if available
                    currentScriptSnapshot: currentScript // Pass current script for comparison in summary
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
            setModalMessage(error instanceof Error ? error.message : 'Failed to execute in studio');
            setShowModal(true);
        } finally {
            setExecuteLoading(null)
            setLoadingStep(0) // Reset step
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

            // Build system prompt with selected project context
            let contextMessages = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))

            // If a project is selected, prepend context to the first user message
            if (selectedProject) {
                const projectMetricValue = selectedProject.metrics?.accuracy
                    ?? selectedProject.metrics?.silhouette
                    ?? selectedProject.metrics?.r2
                const metricDisplay = projectMetricValue
                    ? `${(projectMetricValue * 100).toFixed(1)}%`
                    : 'N/A'

                // Build comprehensive context with dataset info
                let projectContext = `[CONTEXT] User has selected project: "${selectedProject.name}"
- Algorithm: ${selectedProject.algorithm || 'Unknown'}
- Score: ${metricDisplay}
- ProjectId: ${selectedProject.projectId || selectedProject.model_id}`

                // Add dataset information if available
                if (datasetSchema) {
                    projectContext += `\n\nDATASET INFORMATION:
- Filename: ${datasetSchema.filename}
- Rows: ${datasetSchema.rowCount?.toLocaleString() || 'Unknown'}
- Columns (${datasetSchema.columns?.length || 0}): ${datasetSchema.columns?.slice(0, 20).join(', ')}${(datasetSchema.columns?.length || 0) > 20 ? '...' : ''}`

                    // Add column types
                    if (datasetSchema.columnTypes && Object.keys(datasetSchema.columnTypes).length > 0) {
                        const typesSummary = Object.entries(datasetSchema.columnTypes)
                            .slice(0, 10)
                            .map(([col, type]) => `${col}: ${type}`)
                            .join(', ')
                        projectContext += `\n- Column Types: ${typesSummary}${Object.keys(datasetSchema.columnTypes).length > 10 ? '...' : ''}`
                    }

                    // Add missing values info
                    if (datasetSchema.missingValues && Object.keys(datasetSchema.missingValues).length > 0) {
                        const missingInfo = Object.entries(datasetSchema.missingValues)
                            .slice(0, 5)
                            .map(([col, count]) => `${col}: ${count}`)
                            .join(', ')
                        projectContext += `\n- Columns with Missing Values: ${missingInfo}`
                    }

                    if (datasetSchema.targetColumn) {
                        projectContext += `\n- Target Column: ${datasetSchema.targetColumn}`
                    }

                    if (datasetSchema.qualityScore) {
                        projectContext += `\n- Data Quality Score: ${datasetSchema.qualityScore}%`
                    }
                }


                if (projectHistoryContext) {
                    projectContext += `\n\n${projectHistoryContext}`;
                }

                projectContext += `\n\nAnswer all questions in context of this selected project with specific knowledge of its dataset. Provide actionable suggestions for improving model accuracy. You are an expert 'God' of this project who knows every model trained, every metric, and the actual code used.\n\n`


                // Prepend context to the current user message
                contextMessages = contextMessages.map((m, idx) => {
                    if (idx === contextMessages.length - 1 && m.role === 'user') {
                        return { ...m, content: projectContext + m.content }
                    }
                    return m
                })
            }

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: contextMessages,
                    modelId: selectedModel.id,
                    // Add Context for God Mode logic in api/chat
                    datasetInfo: datasetSchema ? {
                        filename: datasetSchema.filename,
                        columns: datasetSchema.columns,
                        rows: datasetSchema.rowCount,
                        targetColumn: datasetSchema.targetColumn
                    } : undefined,
                    currentScript: currentScript
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
                projectId: selectedProject?.projectId || null,  // Link to selected project
                projectName: selectedProject?.name || null,
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
            // Removed: setShowHistory(false) - Let user stay on History tab
        } catch (err) {
            console.error('Error loading session messages:', err)
        }
    }

    // Start new chat
    const startNewChat = () => {
        setMessages([])
        setCurrentSessionId(null)
        // Removed: setShowHistory(false) - Keep user on current tab
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
                    || (data.algorithm && data.target_column ? `${data.algorithm} (${data.target_column})` : null)
                    || (data.target_column ? `${data.target_column} Model` : null)
                    || (data.algorithm ? `${data.algorithm} Model` : null)
                    || 'ML Model'

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
                    user_email: data.user_email,
                    // Include metrics for accuracy/silhouette badges
                    metrics: data.metrics || {}
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

            // DEDUPLICATION: Remove duplicates by projectId (keep the most recent one)
            const seenProjectIds = new Set<string>();
            const seenNames = new Set<string>();
            modelsList = modelsList.filter((m: any) => {
                // Prefer projectId for uniqueness, fallback to model_id
                const uniqueKey = m.projectId || m.model_id;
                if (seenProjectIds.has(uniqueKey)) {
                    return false; // Skip duplicate
                }
                // Also check by name to catch edge cases
                if (seenNames.has(m.name)) {
                    return false; // Skip duplicate by name
                }
                seenProjectIds.add(uniqueKey);
                seenNames.add(m.name);
                return true;
            });

            // Sort client-side
            modelsList.sort((a: any, b: any) => (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0))

            const mlModels = modelsList.map((m: any, idx: number) => ({
                id: `ml-${idx}`,
                name: m.name,
                type: "ml",
                algorithm: m.algorithm,
                model_id: m.model_id,
                latency: "N/A",
                projectId: m.projectId,
                metrics: m.metrics || {}
            }))

            setDeployedModels(mlModels)
            setLoadingModels(false)
            // IMPORTANT: Don't change selectedModel - keep it as GenAI model only
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
                    speed={1.5}
                    amplitude={1.2}
                />
            </div>,
            document.body
        )
    }, [mounted, themeColor])

    return (
        <>
            {backgroundElement}
            <div className="flex flex-col min-h-screen text-white font-sans selection:bg-pink-500/30 relative z-40">
                <div className="fixed top-0 right-0 z-[60]"><ThemeToggle /></div>
                <div className="relative z-50"><Navbar /></div>

                <main className="relative z-10 flex-1 flex flex-col items-center justify-start p-6 mt-16 w-full">
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto mb-12 text-center">
                        <h1
                            className="text-5xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-2xl animate-gradient-text"
                            style={{
                                backgroundImage: `linear-gradient(135deg, ${themeColor}, #ffffff 40%, ${themeColor})`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                backgroundSize: '200% 200%'
                            }}
                        >
                            Let's Chat
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
                            Connect with AI models and collaborate seamlessly
                        </p>
                    </motion.div>

                    <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 h-[600px] overflow-y-auto pb-24">
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
                                    onClick={() => selectedProject && setShowHistory(true)}
                                    disabled={!selectedProject}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all",
                                        showHistory ? "bg-white/20" : "bg-white/5 hover:bg-white/10",
                                        !selectedProject && "opacity-40 cursor-not-allowed"
                                    )}
                                    style={{ color: showHistory ? themeColor : 'rgba(255,255,255,0.6)' }}
                                    title={!selectedProject ? "Select a project first" : "View chat history for this project"}
                                >
                                    <History className="w-4 h-4" />
                                    History
                                </button>
                            </div>

                            {showHistory ? (
                                /* Chat History View */
                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-white/40 text-center uppercase tracking-wider mb-2 px-2">Chats for {selectedProject?.name || 'Project'}</div>

                                    {/* Filter sessions by selected project */}
                                    {chatSessions.filter(s => s.projectId === selectedProject?.projectId).length === 0 ? (
                                        <div className="text-white/40 text-sm px-2 italic text-center py-8">
                                            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            No chat history for this project yet
                                        </div>
                                    ) : (
                                        chatSessions.filter(s => s.projectId === selectedProject?.projectId).map((session) => (
                                            <div
                                                key={session.id}
                                                className={cn(
                                                    "relative w-full p-3 rounded-xl transition-all border group",
                                                    currentSessionId === session.id
                                                        ? "bg-white/20 border-2"
                                                        : "bg-white/5 border-white/10 hover:bg-white/10"
                                                )}
                                                style={{
                                                    borderColor: currentSessionId === session.id ? themeColor : undefined
                                                }}
                                            >
                                                <button
                                                    onClick={() => loadSessionMessages(session.id)}
                                                    className="w-full text-left"
                                                >
                                                    <div className="font-bold text-white text-sm truncate pr-8">{session.title}</div>
                                                    <div className="text-xs text-white/40 truncate mt-1">{session.lastMessage}</div>
                                                </button>

                                                {/* Delete Button with Smooth Confirmation */}
                                                {deleteConfirmId === session.id ? (
                                                    // Confirmation buttons
                                                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/90 rounded-lg p-1 border border-red-500/50 z-10">
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    const messagesRef = collection(db, 'chat_sessions', session.id, 'messages');
                                                                    const messagesSnapshot = await getDocs(messagesRef);
                                                                    messagesSnapshot.docs.forEach(msgDoc => deleteDoc(msgDoc.ref));
                                                                    await deleteDoc(doc(db, 'chat_sessions', session.id));
                                                                    setChatSessions(prev => prev.filter(s => s.id !== session.id));
                                                                    if (currentSessionId === session.id) {
                                                                        setCurrentSessionId(null);
                                                                        setMessages([]);
                                                                    }
                                                                    setDeleteConfirmId(null);
                                                                } catch (err) {
                                                                    console.error('Delete failed:', err);
                                                                }
                                                            }}
                                                            className="px-2 py-1 rounded bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteConfirmId(null);
                                                            }}
                                                            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirmId(session.id);
                                                        }}
                                                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Delete chat"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                    </button>
                                                )}
                                            </div>
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
                                            <div className="text-xs text-center font-bold text-white/40 uppercase tracking-wider mb-2 px-2">Your Trained Models</div>

                                            {/* New Chat button - only shown when a project is selected */}
                                            {selectedProject && (
                                                <button
                                                    onClick={startNewChat}
                                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] mb-2"
                                                    style={{ background: `${themeColor}30`, color: themeColor, border: `1px solid ${themeColor}50` }}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    New Chat
                                                </button>
                                            )}
                                            {deployedModels.length === 0 ? (
                                                <div className="text-white/40 text-center text-sm px-2 italic">No trained models found.</div>
                                            ) : (
                                                deployedModels.map((model) => (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => {
                                                            setSelectedProject(model);
                                                        }}
                                                        className={cn(
                                                            "w-full p-4 rounded-2xl border transition-all",
                                                            selectedProject?.id === model.id
                                                                ? "bg-white/20 border-2"
                                                                : "bg-white/5 border-white/10 hover:bg-white/10"
                                                        )}
                                                        style={{
                                                            borderColor: selectedProject?.id === model.id ? themeColor : undefined,
                                                            boxShadow: selectedProject?.id === model.id ? `0 0 15px ${themeColor}20` : undefined
                                                        }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="font-bold text-white text-sm" style={{ color: selectedProject?.id === model.id ? themeColor : 'white' }}>{model.name}</div>
                                                            {user?.photoURL ? (
                                                                <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full object-cover ring-2 ring-white/20" />
                                                            ) : (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">ML</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-white/40 flex items-center gap-2 justify-between">
                                                            <span className="flex items-center gap-1">
                                                                <Zap className="w-3 h-3" style={{ color: selectedProject?.id === model.id ? themeColor : undefined }} />
                                                                {model.algorithm}
                                                            </span>
                                                            {model.metrics && (model.metrics.accuracy != null || model.metrics.silhouette != null || model.metrics.r2 != null) && (
                                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ background: `${themeColor}30`, color: themeColor }}>
                                                                    {model.metrics.accuracy != null ? `${(model.metrics.accuracy * 100).toFixed(1)}%` :
                                                                        model.metrics.silhouette != null ? `${(Math.abs(model.metrics.silhouette) * 100).toFixed(1)}%` :
                                                                            model.metrics.r2 != null ? `${(model.metrics.r2 * 100).toFixed(1)}%` :
                                                                                model.metrics.rmse != null ? `${model.metrics.rmse.toFixed(1)}` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-white/30 mt-2 italic">
                                                            {selectedProject?.id === model.id ? '✓ Selected for Studio' : 'Click to select project'}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Fixed Retrain Button at Bottom */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-sm">
                                <button
                                    onClick={() => {
                                        // Grab last 6 messages for context
                                        const recentMessages = messages.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
                                        const contextMessage = `Context from recent chat:\n${recentMessages}\n\nUser Goal: Update the model based on this conversation.`;

                                        // Store chat history and context in localStorage for Studio
                                        localStorage.setItem('chatContextForStudio', JSON.stringify({
                                            projectId: selectedProject?.projectId,
                                            projectName: selectedProject?.name,
                                            algorithm: selectedProject?.algorithm,
                                            chatMessages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                                            chatSummary: recentMessages,
                                            datasetSchema: datasetSchema,
                                            timestamp: Date.now()
                                        }));

                                        handleExecuteInStudio(contextMessage, 'manual-retrain', true);
                                    }}
                                    disabled={messages.length === 0 || !!executeLoading}
                                    className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                                    style={{
                                        background: `linear-gradient(135deg, ${themeColor}60, ${themeColor}40)`,
                                        border: `1px solid ${themeColor}80`,
                                        color: 'white',
                                        boxShadow: `0 8px 25px ${themeColor}30`
                                    }}
                                >
                                    {executeLoading === 'manual-retrain' ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Rocket className="w-4 h-4" />
                                    )}
                                    Retrain in Studio
                                </button>
                            </div>
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

                                {/* Project Context Badge */}
                                {selectedProject && (
                                    <div
                                        className="flex flex-col items-center gap-1"
                                    >
                                        <div
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
                                            style={{
                                                background: `${themeColor}15`,
                                                borderColor: `${themeColor}40`
                                            }}
                                        >
                                            <Database className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                            <span className="text-white/60">Chatting about:</span>
                                            <span className="font-bold" style={{ color: themeColor }}>{selectedProject.name}</span>
                                        </div>
                                        {datasetSchema && (
                                            <span className="text-[10px] text-white/40">
                                                Dataset • {datasetSchema.columns?.length} cols • {datasetSchema.rowCount?.toLocaleString()} rows
                                            </span>
                                        )}
                                    </div>
                                )}

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-medium text-white">
                                            <span>{selectedModel?.name || 'Select Model'}</span>
                                            <ChevronDown className="w-4 h-4 opacity-50" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64 bg-black/90 border-white/10 backdrop-blur-xl text-white">
                                        {genAiModels.map((model: any) => {
                                            const isLocked = !canAccessModel(model.tier)

                                            // Get icon component based on model
                                            const ModelIcon = model.icon === 'zap' ? Zap : model.icon === 'server' ? Server : Sparkles;

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
                                                        <ModelIcon className="w-4 h-4" style={{ color: themeColor }} />
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
                                            {selectedProject ? (
                                                <>
                                                    <p className="text-white/60 mb-2">Chatting about <span className="font-bold" style={{ color: themeColor }}>{selectedProject.name}</span></p>
                                                    <p className="text-white/40 text-sm">Ask anything about your model's accuracy, suggestions for improvement, or retrain options.</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-white/40 mb-2">Start chatting with {selectedModel?.name || 'AI'}</p>
                                                    <p className="text-white/30 text-sm">💡 Tip: Select a project from the left sidebar for context-aware responses</p>
                                                </>
                                            )}
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
                                                {/* Action buttons removed as per request - using global sidebar button instead */}
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
                                {/* Retrain with Context Button - Sidebar (Removed from here) */}

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
                </main >
            </div >

            {/* Custom Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-md w-full border shadow-2xl" style={{ borderColor: `${themeColor}60`, boxShadow: `0 20px 60px ${themeColor}30` }}>
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 rounded-xl" style={{ background: `${themeColor}20` }}>
                                    <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white mb-2">Notice</h3>
                                    <p className="text-white/70 text-sm leading-relaxed">{modalMessage}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-full py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}CC)`, color: 'white' }}>Got it</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Beautiful 3D Loading Overlay */}
            <AnimatePresence>
                {executeLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    >
                        {/* Floating particles */}
                        <div className="absolute inset-0 overflow-hidden">
                            {[...Array(15)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ x: `${Math.random() * 100}%`, y: '110%', opacity: 0 }}
                                    animate={{ y: '-10%', opacity: [0, 0.5, 0] }}
                                    transition={{ duration: 5 + Math.random() * 3, delay: i * 0.4, repeat: Infinity }}
                                    className="absolute w-1 h-1 rounded-full"
                                    style={{ background: themeColor }}
                                />
                            ))}
                        </div>

                        <div className="text-center -mt-32">
                            {/* Orbital ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[130%] w-64 h-64 rounded-full border opacity-20"
                                style={{ borderColor: themeColor, borderStyle: 'dashed' }}
                            />

                            {/* 3D Rotating Cube - Larger */}
                            <div className="relative w-44 h-44 mx-auto mb-10" style={{ perspective: '600px' }}>
                                <motion.div
                                    animate={{ rotateX: 360, rotateY: 360 }}
                                    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                                    className="w-full h-full relative"
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    {[
                                        { transform: 'translateZ(88px)', bg: `linear-gradient(135deg, ${themeColor}60, ${themeColor}30)` },
                                        { transform: 'rotateY(180deg) translateZ(88px)', bg: `linear-gradient(135deg, ${themeColor}50, ${themeColor}20)` },
                                        { transform: 'rotateY(90deg) translateZ(88px)', bg: `linear-gradient(135deg, ${themeColor}70, ${themeColor}40)` },
                                        { transform: 'rotateY(-90deg) translateZ(88px)', bg: `linear-gradient(135deg, ${themeColor}40, ${themeColor}15)` },
                                        { transform: 'rotateX(90deg) translateZ(88px)', bg: `linear-gradient(135deg, ${themeColor}55, ${themeColor}25)` },
                                        { transform: 'rotateX(-90deg) translateZ(88px)', bg: `linear-gradient(135deg, ${themeColor}45, ${themeColor}18)` },
                                    ].map((face, i) => (
                                        <div
                                            key={i}
                                            className="absolute inset-0 rounded-2xl border-2 backdrop-blur-md flex items-center justify-center"
                                            style={{
                                                transform: face.transform,
                                                background: face.bg,
                                                borderColor: themeColor,
                                                boxShadow: `0 0 50px ${themeColor}80, inset 0 0 25px ${themeColor}30`
                                            }}
                                        >
                                            <Sparkles className="w-10 h-10" style={{ color: 'white', filter: 'drop-shadow(0 0 10px white)' }} />
                                        </div>
                                    ))}
                                </motion.div>
                            </div>

                            {/* Spacer to push text below cube */}
                            <div className="h-8" />

                            {/* Pulsing glow ring */}
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full -z-10"
                                style={{ background: `radial-gradient(circle, ${themeColor}40 0%, transparent 70%)` }}
                            />

                            {/* Loading text with gradient */}
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-3xl font-bold mb-6"
                                style={{
                                    background: `linear-gradient(135deg, white, ${themeColor})`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}
                            >
                                Generating AI Suggestion
                            </motion.h2>

                            {/* Horizontal Timeline */}
                            <div className="flex items-center justify-center gap-0 mb-6">
                                {[
                                    { step: 1, label: 'Fetching Data', icon: Database },
                                    { step: 2, label: 'Generating Code', icon: Sparkles },
                                    { step: 3, label: 'Saving to Studio', icon: Rocket }
                                ].map((item, idx) => {
                                    const isComplete = loadingStep > item.step;
                                    const isActive = loadingStep === item.step;
                                    const Icon = item.icon;

                                    return (
                                        <div key={item.step} className="flex items-center">
                                            {/* Step circle */}
                                            <motion.div
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{
                                                    scale: isActive ? [1, 1.1, 1] : 1,
                                                    opacity: 1
                                                }}
                                                transition={{
                                                    delay: idx * 0.1,
                                                    duration: isActive ? 0.8 : 0.3,
                                                    repeat: isActive ? Infinity : 0
                                                }}
                                                className="flex flex-col items-center"
                                            >
                                                <div
                                                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isComplete ? 'border-green-400' : isActive ? '' : 'border-white/20'
                                                        }`}
                                                    style={{
                                                        borderColor: isActive ? themeColor : undefined,
                                                        background: isComplete
                                                            ? 'rgba(34, 197, 94, 0.2)'
                                                            : isActive
                                                                ? `${themeColor}30`
                                                                : 'rgba(255,255,255,0.05)',
                                                        boxShadow: isActive ? `0 0 20px ${themeColor}60` : 'none'
                                                    }}
                                                >
                                                    {isComplete ? (
                                                        <Check className="w-5 h-5 text-green-400" />
                                                    ) : (
                                                        <Icon
                                                            className={`w-5 h-5 ${isActive ? '' : 'text-white/40'}`}
                                                            style={{ color: isActive ? themeColor : undefined }}
                                                        />
                                                    )}
                                                </div>
                                                <span className={`text-[10px] mt-2 font-medium whitespace-nowrap ${isComplete ? 'text-green-400' : isActive ? 'text-white' : 'text-white/40'
                                                    }`}>
                                                    {item.label}
                                                </span>
                                            </motion.div>

                                            {/* Connecting line */}
                                            {idx < 2 && (
                                                <div className="w-12 h-0.5 mx-2 relative">
                                                    <div className="absolute inset-0 bg-white/10 rounded-full" />
                                                    <motion.div
                                                        initial={{ width: '0%' }}
                                                        animate={{ width: loadingStep > item.step ? '100%' : '0%' }}
                                                        transition={{ duration: 0.5 }}
                                                        className="absolute inset-0 rounded-full"
                                                        style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80)` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Current step text */}
                            <motion.div
                                key={loadingStep}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-center gap-2 text-white/70"
                            >
                                <Loader2 className="w-4 h-4 animate-spin" style={{ color: themeColor }} />
                                <span className="text-sm">
                                    {loadingStep === 1 && 'Fetching dataset schema...'}
                                    {loadingStep === 2 && 'AI is generating improved code...'}
                                    {loadingStep === 3 && 'Saving suggestion to Studio...'}
                                    {loadingStep === 0 && 'Preparing...'}
                                </span>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
