"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import FloatingLines from "@/components/react-bits/FloatingLines"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/context/auth-context"
import {
    Rocket, Play, Terminal, X, Loader2, Sparkles
} from "lucide-react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Types based on API
interface Model {
    model_id: string
    target_column: string
    algorithm: string
    name?: string
    status?: 'training' | 'ready' | 'deployed' | 'archived'
    visibility?: 'private' | 'public'
    metrics: {
        accuracy?: number
        precision?: number
        recall?: number
        f1_score?: number
    }
    feature_columns?: string[]
    created_at: string
    deployedAt?: any
    uses?: number
    ownerName?: string
    ownerPhotoURL?: string
    user_email?: string
}

export default function DeployPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const { user } = useAuth()
    const [models, setModels] = useState<Model[]>([])
    const [loading, setLoading] = useState(true)
    const [isPredictModalOpen, setIsPredictModalOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState<Model | null>(null)

    // Set default theme color to Gold on mount
    useEffect(() => {
        setThemeColor("#6f510bff")
    }, [setThemeColor])

    // Fetch Models and enrich with feature counts
    // Fetch Models and enrich with feature counts
    useEffect(() => {
        if (!user) return

        setLoading(true)

        // Listen to both models and datasets
        const modelsQuery = query(collection(db, "models"), orderBy("createdAt", "desc"))
        const datasetsQuery = query(collection(db, "datasets"), orderBy("createdAt", "desc"))

        const unsubscribeModels = onSnapshot(modelsQuery, (modelsSnap) => {
            const unsubscribeDatasets = onSnapshot(datasetsQuery, (datasetsSnap) => {

                const datasets = datasetsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as any[]

                let modelsList = modelsSnap.docs.map(doc => ({
                    model_id: doc.id,
                    ...doc.data()
                })) as Model[]

                // Filter models by user - check multiple possible owner fields
                if (user?.uid || user?.email) {
                    modelsList = modelsList.filter((m: any) =>
                        m.ownerId === user?.uid ||
                        m.userId === user?.uid ||
                        m.createdBy === user?.uid ||
                        m.user_id === user?.uid ||
                        m.owner_email === user?.email ||
                        m.ownerEmail === user?.email ||
                        m.user_email === user?.email
                    )
                }

                // Enrich with feature columns
                modelsList = modelsList.map((model: Model) => {
                    // Try to find matching dataset (most recent one or by linking ID if available - here heuristics)
                    // Ideally model doc should have datasetId. Falling back to most recent compatible or similar heuristics
                    const dataset = datasets.find((d: any) => d.columns && d.columns.length > 0)

                    if (dataset && dataset.columns) {
                        const featureColumns = dataset.columns.filter((col: string) => col !== model.target_column)
                        return { ...model, feature_columns: featureColumns }
                    }
                    return model
                })

                setModels(modelsList)
                setLoading(false)
            })

            return () => unsubscribeDatasets()
        })

        return () => unsubscribeModels()
    }, [user])

    const getAccuracy = (model: Model) => {
        const acc = model.metrics?.accuracy
        if (acc === undefined || acc === null || isNaN(acc)) return "N/A"
        return `${(acc * 100).toFixed(1)}%`
    }

    return (
        <>
            <div className="fixed inset-0 bg-black" style={{ zIndex: 0 }}>
                <FloatingLines
                    key={themeColor}
                    linesGradient={[themeColor, themeColor, themeColor]}
                    enabledWaves={['top', 'middle', 'bottom']}
                    lineCount={[3, 3, 3]}
                    lineDistance={[5, 3, 5]}
                    animationSpeed={1.5}
                    mixBlendMode="screen"
                />
            </div>

            <div className="fixed top-0 right-0 z-50"><ThemeToggle /></div>
            <div className="relative z-40"><Navbar /></div>

            <main className="relative z-10 min-h-screen p-6 pt-24 pb-12">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col items-center justify-center mb-10 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center"
                        >
                            <h1 className="text-3xl md:text-5xl font-black mb-2 tracking-tight">
                                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
                                    My Deployments
                                </span>
                            </h1>
                            <p className="text-sm text-white/60 max-w-md mx-auto">
                                Manage your trained models - deploy, undeploy, and run private predictions.
                            </p>
                            {/* Quick nav to marketplace */}
                            <a
                                href="/marketplace"
                                className="inline-flex items-center gap-2 mt-3 text-xs text-white/40 hover:text-white/60 transition-colors"
                            >
                                <Sparkles className="w-3 h-3" />
                                Looking for community models? Visit Marketplace →
                            </a>
                        </motion.div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                        </div>
                    ) : models.length === 0 ? (
                        <div className="text-center py-20">
                            <div
                                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                style={{ backgroundColor: `${themeColor}20` }}
                            >
                                <Rocket className="w-8 h-8" style={{ color: themeColor }} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">No models yet</h3>
                            <p className="text-white/40 mb-6 max-w-sm mx-auto">
                                Train your first model in the Studio, then manage deployments here.
                            </p>
                            <a
                                href="/studio"
                                className="px-6 py-3 rounded-xl font-bold text-black transition-all hover:scale-105 shadow-lg inline-flex items-center gap-2"
                                style={{ background: themeColor }}
                            >
                                <Rocket className="w-4 h-4" />
                                Go to Studio
                            </a>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                            {models.map((model, index) => (
                                <motion.div
                                    key={model.model_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="group relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl transition-all duration-300 group-hover:opacity-100 opacity-80" />
                                    <div className="relative bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 group-hover:-translate-y-1">
                                        {/* Header with icon and status */}
                                        <div className="p-5 pb-0">
                                            <div className="flex items-start justify-between mb-4">
                                                <div
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}10)`,
                                                        boxShadow: `0 0 20px ${themeColor}20`
                                                    }}
                                                >
                                                    <Rocket className="w-6 h-6" style={{ color: themeColor }} />
                                                </div>
                                                {/* Status Badge */}
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${model.status === 'deployed'
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : model.status === 'training'
                                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                        : 'bg-white/10 text-white/50 border border-white/10'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${model.status === 'deployed' ? 'bg-green-500' :
                                                        model.status === 'training' ? 'bg-yellow-500 animate-pulse' :
                                                            'bg-white/50'
                                                        }`} />
                                                    {model.status === 'deployed' ? 'Live' : model.status || 'Ready'}
                                                </div>
                                            </div>

                                            {/* Model Name */}
                                            <h3 className="text-lg font-bold text-white mb-1 truncate">
                                                {model.name || `${model.target_column} Model`}
                                            </h3>
                                            <p className="text-xs text-white/40 mb-4">{model.algorithm}</p>
                                        </div>

                                        {/* Metrics Grid */}
                                        <div className="px-5 grid grid-cols-3 gap-2 mb-4">
                                            <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-center">
                                                <div className="text-[9px] text-white/40 uppercase tracking-wider">Accuracy</div>
                                                <p className="text-sm font-bold" style={{ color: themeColor }}>{getAccuracy(model)}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-center">
                                                <div className="text-[9px] text-white/40 uppercase tracking-wider">Features</div>
                                                <p className="text-sm font-bold text-white">{model.feature_columns?.length || 0}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-center">
                                                <div className="text-[9px] text-white/40 uppercase tracking-wider">Uses</div>
                                                <p className="text-sm font-bold text-white">{model.uses || 0}</p>
                                            </div>
                                        </div>

                                        {/* Footer with Owner Info */}
                                        <div className="px-5 pb-4 border-t border-white/5 pt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {model.ownerPhotoURL ? (
                                                    <img src={model.ownerPhotoURL} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                                                        {(model.ownerName || 'U')[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-xs text-white/40 truncate max-w-[100px]">
                                                    {model.ownerName || 'You'}
                                                </span>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${model.visibility === 'public'
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'bg-white/10 text-white/40'
                                                }`}>
                                                {model.visibility === 'public' ? 'Public' : 'Private'}
                                            </span>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            onClick={() => {
                                                setSelectedModel(model)
                                                setIsPredictModalOpen(true)
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-all hover:brightness-110 border-t border-white/10"
                                            style={{ background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)` }}
                                        >
                                            <Play className="w-4 h-4" />
                                            {model.status === 'deployed' ? 'Test Model' : 'Try Model'}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {selectedModel && (
                <PredictionModal
                    isOpen={isPredictModalOpen}
                    onClose={() => setIsPredictModalOpen(false)}
                    model={selectedModel}
                    themeColor={themeColor}
                />
            )}
        </>
    )
}

function PredictionModal({ isOpen, onClose, model, themeColor }: any) {
    const [formData, setFormData] = useState<Record<string, string>>({})
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [featureColumns, setFeatureColumns] = useState<string[]>([])
    const [loadingColumns, setLoadingColumns] = useState(true)
    const [aiSuggestions, setAiSuggestions] = useState<string>("")
    const [loadingSuggestions, setLoadingSuggestions] = useState(false)

    useEffect(() => {
        if (isOpen && model) {
            fetchDatasetColumns()
        }
    }, [isOpen, model])

    const fetchDatasetColumns = async () => {
        try {
            setLoadingColumns(true)
            if (model.feature_columns && model.feature_columns.length > 0) {
                setFeatureColumns(model.feature_columns)
                initializeFormData(model.feature_columns)
                setLoadingColumns(false)
                return
            }

            // Fetch all datasets and find the one used for this model
            const res = await fetch('/api/proxy/datasets')
            if (res.ok) {
                const data = await res.json()
                const datasets = data.datasets || []

                // Try to find the dataset that matches this model's training data
                // For now, we'll use the most recent dataset or first available
                if (datasets.length > 0) {
                    // Sort by created_at to get most recent
                    const sortedDatasets = [...datasets].sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )

                    const dataset = sortedDatasets[0]
                    if (dataset.columns) {
                        // Filter out the target column
                        const cols = dataset.columns.filter((col: string) => col !== model.target_column)
                        setFeatureColumns(cols)
                        initializeFormData(cols)
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch columns:', error)
        } finally {
            setLoadingColumns(false)
        }
    }

    const initializeFormData = (columns: string[]) => {
        const initial: Record<string, string> = {}
        columns.forEach((col: string) => { initial[col] = "" })
        setFormData(initial)
    }

    const fillSampleData = () => {
        if (!featureColumns || featureColumns.length === 0) return

        const sample: Record<string, string> = {}
        featureColumns.forEach((col: string) => {
            const colLower = col.toLowerCase()

            // Generate random realistic NUMERIC values (ML models expect encoded data)
            if (colLower.includes('age')) {
                sample[col] = String(Math.floor(Math.random() * 50) + 20) // 20-70
            } else if (colLower.includes('income') || colLower.includes('salary')) {
                sample[col] = String(Math.floor(Math.random() * 80000) + 30000) // 30k-110k
            } else if (colLower.includes('score') || colLower.includes('gpa') || colLower.includes('rating')) {
                sample[col] = (Math.random() * 4 + 1).toFixed(1) // 1.0-5.0
            } else if (colLower.includes('gender') || colLower.includes('sex')) {
                // Binary encoding: 0 or 1
                sample[col] = String(Math.floor(Math.random() * 2)) // 0 or 1
            } else if (colLower.includes('city') || colLower.includes('location')) {
                // Categorical encoding: 0-5 for different cities
                sample[col] = String(Math.floor(Math.random() * 6))
            } else if (colLower.includes('experience') || colLower.includes('years')) {
                sample[col] = String(Math.floor(Math.random() * 15) + 1) // 1-15 years
            } else if (colLower.includes('education') || colLower.includes('degree')) {
                // Ordinal encoding: 0-3 (High School, Bachelor, Master, PhD)
                sample[col] = String(Math.floor(Math.random() * 4))
            } else if (colLower.includes('blood') || colLower.includes('pressure') || colLower.includes('bp') || colLower.includes('resting_bp')) {
                sample[col] = String(Math.floor(Math.random() * 40) + 100) // 100-140
            } else if (colLower.includes('glucose') || colLower.includes('sugar') || colLower.includes('fasting')) {
                sample[col] = String(Math.floor(Math.random() * 60) + 70) // 70-130
            } else if (colLower.includes('bmi')) {
                sample[col] = (Math.random() * 15 + 18).toFixed(1) // 18-33
            } else if (colLower.includes('heart') || colLower.includes('rate') || colLower.includes('pulse') || colLower.includes('max_heart')) {
                sample[col] = String(Math.floor(Math.random() * 40) + 60) // 60-100
            } else if (colLower.includes('cholesterol') || colLower.includes('chol')) {
                sample[col] = String(Math.floor(Math.random() * 100) + 150) // 150-250
            } else if (colLower.includes('price') || colLower.includes('cost') || colLower.includes('amount')) {
                sample[col] = (Math.random() * 900 + 100).toFixed(2) // 100-1000
            } else if (colLower.includes('quantity') || colLower.includes('count') || colLower.includes('num_')) {
                sample[col] = String(Math.floor(Math.random() * 10)) // 0-9
            } else if (colLower.includes('percent') || colLower.includes('depression') || colLower.includes('st_')) {
                sample[col] = (Math.random() * 5).toFixed(1) // 0-5.0
            } else if (colLower.includes('pain') || colLower.includes('angina') || colLower.includes('ecg') || colLower.includes('slope')) {
                // Categorical medical features: 0-3
                sample[col] = String(Math.floor(Math.random() * 4))
            } else if (colLower.includes('vessels') || colLower.includes('thal')) {
                // Medical categorical: 0-3
                sample[col] = String(Math.floor(Math.random() * 4))
            } else if (colLower.includes('type') || colLower.includes('category') || colLower.includes('class') || colLower.includes('line')) {
                // Generic categorical: 0-4
                sample[col] = String(Math.floor(Math.random() * 5))
            } else if (colLower.includes('status') || colLower.includes('state')) {
                // Binary or small categorical: 0-2
                sample[col] = String(Math.floor(Math.random() * 3))
            } else if (colLower.includes('code') || colLower.includes('id')) {
                // Numeric ID: 1-1000
                sample[col] = String(Math.floor(Math.random() * 1000) + 1)
            } else {
                // Default: random number between 1-100
                sample[col] = String(Math.floor(Math.random() * 100) + 1)
            }
        })
        setFormData(sample)
    }

    const getAiSuggestions = async () => {
        setLoadingSuggestions(true)
        setAiSuggestions("") // Clear previous suggestions
        try {
            const accuracy = model.metrics?.accuracy || 0
            console.log('=== AI Suggestions Request ===')
            console.log('Model:', model.algorithm, 'Target:', model.target_column, 'Accuracy:', accuracy)
            console.log('Features:', featureColumns)

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: `I have a ${model.algorithm} model predicting ${model.target_column} with ${(accuracy * 100).toFixed(1)}% accuracy. The features are: ${featureColumns.join(', ')}. Why is the accuracy low and how can I improve it? Give me 3-5 specific, actionable suggestions.`
                    }],
                    modelId: 2
                })
            })

            console.log('AI Suggestions Response Status:', response.status)

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            if (response.ok) {
                const reader = response.body?.getReader()
                const decoder = new TextDecoder()
                let suggestions = ""
                while (true) {
                    const { done, value } = await reader!.read()
                    if (done) break
                    suggestions += decoder.decode(value)
                    setAiSuggestions(suggestions)
                }
                console.log('AI Suggestions Complete:', suggestions.length, 'characters')
            }
        } catch (error: any) {
            console.error('AI Suggestions Error:', error)
            setAiSuggestions(`Failed to get suggestions: ${error.message}. Please try again.`)
        } finally {
            setLoadingSuggestions(false)
        }
    }

    const handlePredict = async () => {
        try {
            setLoading(true)
            setResult(null) // Clear previous result

            const data: Record<string, any> = {}
            Object.entries(formData).forEach(([key, value]) => {
                const numValue = parseFloat(value)
                data[key] = isNaN(numValue) ? value : numValue
            })

            const timestamp = Date.now()
            console.log('=== Prediction Request ===')
            console.log('Timestamp:', timestamp)
            console.log('Model ID:', model.model_id)
            console.log('Input Data:', JSON.stringify(data, null, 2))

            const res = await fetch('/api/proxy/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': timestamp.toString() // Add unique request ID
                },
                body: JSON.stringify({
                    model_id: model.model_id,
                    data,
                    timestamp // Add timestamp to payload
                })
            })

            const json = await res.json()
            console.log('=== Prediction Response ===')
            console.log('Status:', res.status)
            console.log('Response:', JSON.stringify(json, null, 2))
            console.log('Prediction:', json.prediction)
            console.log('Confidence:', json.probability)

            // Check if this might be a cached response
            if (result && json.prediction === result.prediction && json.probability === result.probability) {
                console.warn('⚠️ WARNING: Received identical prediction - possible backend caching!')
            }

            setResult(json)
        } catch (e: any) {
            console.error('Prediction error:', e)
            setResult({ error: `Request Failed: ${e.message}` })
        } finally {
            setLoading(false)
        }
    }

    const isModelReady = model.status === 'deployed' || model.status === 'ready' || featureColumns.length > 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-2xl bg-black/60 backdrop-blur-2xl border border-white/15 rounded-3xl overflow-hidden shadow-2xl"
                        style={{ boxShadow: `0 0 60px ${themeColor}25` }}
                    >
                        {/* Glow Effect */}
                        <div
                            className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30"
                            style={{ background: `radial-gradient(circle, ${themeColor}, transparent)` }}
                        />

                        {/* Header */}
                        <div className="p-6 pb-0 relative z-10">
                            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                                <X className="w-4 h-4 text-white/60" />
                            </button>

                            <div className="flex flex-col items-center text-center mb-6">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border border-white/20"
                                    style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                                >
                                    <Play className="w-7 h-7" style={{ color: themeColor }} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-1">Test Model</h2>
                                <p className="text-xs text-white/50 font-mono truncate max-w-full">{model.model_id}</p>
                            </div>

                            {/* Model Info Badge */}
                            <div className="flex flex-wrap justify-center gap-2 mb-4">
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-white/60">
                                    {model.algorithm || 'Unknown Algorithm'}
                                </span>
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold border" style={{ background: `${themeColor}20`, borderColor: `${themeColor}40`, color: themeColor }}>
                                    {model.metrics?.accuracy ? `${(model.metrics.accuracy * 100).toFixed(1)}% Accuracy` : 'N/A'}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${model.status === 'deployed'
                                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                    : 'bg-white/5 border-white/10 text-white/50'
                                    } border`}>
                                    {model.status === 'deployed' ? '● Live' : model.status || 'Ready'}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 pt-0 max-h-[60vh] overflow-y-auto">
                            {!isModelReady ? (
                                <div className="text-center py-8 px-4 bg-white/5 rounded-2xl border border-white/5 mb-4">
                                    <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${themeColor}20` }}>
                                        <Loader2 className="w-6 h-6 animate-pulse" style={{ color: themeColor }} />
                                    </div>
                                    <p className="text-white/60 font-medium mb-1">Model Not Yet Deployed</p>
                                    <p className="text-xs text-white/40">Deploy this model first to run predictions</p>
                                </div>
                            ) : loadingColumns ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
                                </div>
                            ) : featureColumns.length > 0 ? (
                                <>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-white/40 uppercase tracking-wider">Input Features ({featureColumns.length})</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={fillSampleData}
                                                disabled={loadingColumns}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                                                style={{ background: `${themeColor}30`, color: themeColor }}
                                            >
                                                <Sparkles className="w-3 h-3" /> Fill Sample
                                            </button>
                                            <button
                                                onClick={getAiSuggestions}
                                                disabled={loadingSuggestions}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/20 text-purple-300 transition-all hover:brightness-110"
                                            >
                                                {loadingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Tips
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                        {featureColumns.map((col: string) => (
                                            <div key={col}>
                                                <label className="text-[10px] text-white/40 mb-1 block font-medium uppercase tracking-wider">{col}</label>
                                                <input
                                                    type="text"
                                                    value={formData[col] || ""}
                                                    onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                    className="w-full bg-black/40 border rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/20"
                                                    style={{
                                                        borderColor: formData[col] ? `${themeColor}50` : 'rgba(255,255,255,0.1)',
                                                        boxShadow: formData[col] ? `0 0 10px ${themeColor}20` : 'none'
                                                    }}
                                                    placeholder={`Enter ${col}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8 px-4 bg-white/5 rounded-2xl border border-white/5 mb-4">
                                    <p className="text-white/50 mb-1">No feature columns available</p>
                                    <p className="text-xs text-white/30">Retrain the model to populate features</p>
                                </div>
                            )}

                            {aiSuggestions && (
                                <div className="mb-4 p-4 rounded-2xl border" style={{ background: `${themeColor}10`, borderColor: `${themeColor}30` }}>
                                    <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: themeColor }}>
                                        <Sparkles className="w-4 h-4" /> AI Suggestions
                                    </h3>
                                    <div className="text-xs text-white/70 whitespace-pre-wrap">{aiSuggestions}</div>
                                </div>
                            )}

                            {result && (
                                <div className="p-4 rounded-2xl border" style={{ background: result.error ? 'rgba(239,68,68,0.1)' : `${themeColor}15`, borderColor: result.error ? 'rgba(239,68,68,0.3)' : `${themeColor}30` }}>
                                    {result.error ? (
                                        <p className="text-red-400 text-sm text-center">{result.error}</p>
                                    ) : (
                                        <div className="text-center">
                                            <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">Prediction Result</p>
                                            <p className="text-3xl font-black mb-2" style={{ color: themeColor }}>{result.prediction}</p>
                                            {result.probability && (
                                                <p className="text-sm text-white/60">{(result.probability * 100).toFixed(1)}% confidence</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Button */}
                        <div className="p-6 pt-0">
                            <button
                                onClick={handlePredict}
                                disabled={loading || !isModelReady || Object.values(formData).some(v => !v) || featureColumns.length === 0}
                                className="w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:brightness-110 border"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}60, ${themeColor}30)`,
                                    borderColor: `${themeColor}50`
                                }}
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : isModelReady ? "Run Prediction" : "Deploy Model First"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
