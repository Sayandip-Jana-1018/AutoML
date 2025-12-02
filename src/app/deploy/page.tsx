"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import FloatingLines from "@/components/react-bits/FloatingLines"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSession } from "next-auth/react"
import {
    Rocket, Play, Terminal, X, Loader2, Sparkles
} from "lucide-react"

// Types based on API
interface Model {
    model_id: string
    target_column: string
    algorithm: string
    metrics: {
        accuracy?: number
        precision?: number
        recall?: number
        f1_score?: number
    }
    feature_columns?: string[]
    created_at: string
    user_email?: string
}

export default function DeployPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const { data: session } = useSession()
    const [models, setModels] = useState<Model[]>([])
    const [loading, setLoading] = useState(true)
    const [isPredictModalOpen, setIsPredictModalOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState<Model | null>(null)

    // Set default theme color to Gold on mount
    useEffect(() => {
        setThemeColor("#6f510bff")
    }, [setThemeColor])

    // Fetch Models and enrich with feature counts
    const fetchModels = async () => {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            const [modelsRes, datasetsRes] = await Promise.all([
                fetch('/api/proxy/models', { signal: controller.signal }),
                fetch('/api/proxy/datasets', { signal: controller.signal })
            ])
            clearTimeout(timeoutId)

            if (modelsRes.ok) {
                const modelsData = await modelsRes.json()
                let modelsList = modelsData.models || []

                // Enrich models with feature counts from datasets
                if (datasetsRes.ok) {
                    const datasetsData = await datasetsRes.json()
                    const datasets = datasetsData.datasets || []

                    modelsList = modelsList.map((model: Model) => {
                        // Try to find matching dataset (most recent one)
                        const dataset = datasets.find((d: any) => d.columns && d.columns.length > 0)
                        if (dataset && dataset.columns) {
                            // Filter out target column to get feature columns
                            const featureColumns = dataset.columns.filter((col: string) => col !== model.target_column)
                            return { ...model, feature_columns: featureColumns }
                        }
                        return model
                    })
                }

                // Filter models by user email if available
                if (session?.user?.email) {
                    modelsList = modelsList.filter((m: any) => m.user_email === session.user?.email)
                }

                setModels(modelsList)
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('Request timeout - backend may be down')
            } else {
                console.error('Failed to fetch models:', error)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchModels()
        const interval = setInterval(fetchModels, 10000)
        return () => clearInterval(interval)
    }, [])

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
                                    Deployments
                                </span>
                            </h1>
                            <p className="text-sm text-white/60 max-w-md mx-auto">
                                Monitor your active model endpoints and run predictions.
                            </p>
                        </motion.div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                        </div>
                    ) : models.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-white/40 mb-4">No models deployed yet.</p>
                            <a href="/studio" className="px-6 py-3 rounded-xl font-bold text-black transition-all hover:scale-105 shadow-lg inline-block" style={{ background: themeColor }}>
                                Go to Studio to Train
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
                                    <div className="relative bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all duration-300 group-hover:-translate-y-1">
                                        <div className="flex items-start justify-between mb-5">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}10)`,
                                                        boxShadow: `0 0 15px ${themeColor}15`
                                                    }}
                                                >
                                                    <Rocket className="w-5 h-5" style={{ color: themeColor }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-base font-bold text-white truncate pr-2">{model.target_column} Model</h3>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/5">
                                                            {model.algorithm}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                            <span className="text-[10px] font-medium capitalize text-white/40">Ready</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-5">
                                            <div className="bg-white/5 rounded-lg p-2.5 border border-white/5 text-center">
                                                <div className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wider">Accuracy</div>
                                                <p className="text-sm font-bold text-white">{getAccuracy(model)}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2.5 border border-white/5 text-center">
                                                <div className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wider">Features</div>
                                                <p className="text-sm font-bold text-white">{model.feature_columns?.length || 0}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="bg-black/40 rounded-lg p-2.5 border border-white/10 flex items-center justify-between">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Terminal className="w-3 h-3 text-white/30 shrink-0" />
                                                    <code className="text-[10px] text-white/50 truncate font-mono">{model.model_id}</code>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setSelectedModel(model)
                                                    setIsPredictModalOpen(true)
                                                }}
                                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110 shadow-lg"
                                                style={{ background: `linear-gradient(135deg, ${themeColor}80, ${themeColor}40)` }}
                                            >
                                                <Play className="w-3 h-3" /> Test / Predict
                                            </button>
                                        </div>
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

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
                        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Test Model</h2>
                            <p className="text-white/50 text-sm">Model ID: {model.model_id}</p>
                            <p className="text-white/40 text-xs mt-1">
                                Algorithm: {model.algorithm} | Target: {model.target_column} | Accuracy: {model.metrics?.accuracy ? `${(model.metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm text-white/60">Input Features ({featureColumns.length} columns)</label>
                                <div className="flex gap-2">
                                    <button onClick={fillSampleData} disabled={loadingColumns || featureColumns.length === 0} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50" style={{ background: `${themeColor}40`, color: themeColor }}>
                                        <Sparkles className="w-3 h-3" /> Fill Sample Data
                                    </button>
                                    <button onClick={getAiSuggestions} disabled={loadingSuggestions} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 transition-all hover:brightness-110 disabled:opacity-50">
                                        {loadingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Suggestions
                                    </button>
                                </div>
                            </div>

                            {loadingColumns ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
                            ) : featureColumns.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                                    {featureColumns.map((col: string) => (
                                        <div key={col}>
                                            <label className="text-xs text-white/40 mb-1 block font-medium">{col}</label>
                                            <input type="text" value={formData[col] || ""} onChange={e => setFormData({ ...formData, [col]: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-all" placeholder={`Enter ${col}`} style={{ borderColor: formData[col] ? `${themeColor}40` : undefined }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-white/40 text-sm">No feature columns available for this model.</p>
                                    <p className="text-white/30 text-xs mt-2">The model may need to be retrained or the backend needs to be updated.</p>
                                </div>
                            )}

                            {aiSuggestions && (
                                <div className="mb-6 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                                    <h3 className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Suggestions for Improving Accuracy</h3>
                                    <div className="text-xs text-purple-200/80 whitespace-pre-wrap">{aiSuggestions}</div>
                                </div>
                            )}

                            {result && (
                                <div>
                                    <label className="text-sm text-white/60 mb-2 block">Result</label>
                                    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
                                        {result.error ? (
                                            <p className="text-red-400 text-sm">{result.error}</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white/60 text-sm">Prediction:</span>
                                                    <span className="text-lg font-bold" style={{ color: themeColor }}>{result.prediction}</span>
                                                </div>
                                                {result.probability && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white/60 text-sm">Confidence:</span>
                                                        <span className="text-sm font-bold text-white">{(result.probability * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handlePredict} disabled={loading || Object.values(formData).some(v => !v) || featureColumns.length === 0} className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-50 transition-all hover:brightness-110" style={{ background: themeColor }}>
                            {loading ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : "Run Prediction"}
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
