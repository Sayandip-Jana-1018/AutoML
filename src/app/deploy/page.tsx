
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import FloatingLines from "@/components/react-bits/FloatingLines"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/context/auth-context"
import {
    Rocket, Play, Activity, Key, Loader2, Sparkles
} from "lucide-react"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ApiKeyModal } from "@/components/deploy/ApiKeyModal"
import { LogsModal } from "@/components/deploy/LogsModal"
import { PredictionModal } from "@/components/deploy/PredictionModal"

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
        // Regression metrics
        rmse?: number
        r2?: number
        mae?: number
        mse?: number
        // Clustering metrics
        silhouette?: number
        inertia?: number
        extractedFrom?: string
    }
    feature_columns?: string[]
    created_at: string
    deployedAt?: any
    uses?: number
    ownerName?: string
    ownerPhotoURL?: string
    user_email?: string
    taskType?: string
}

export default function DeployPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const { user } = useAuth()
    const [models, setModels] = useState<Model[]>([])
    const [loading, setLoading] = useState(true)
    const [isPredictModalOpen, setIsPredictModalOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState<Model | null>(null)

    // New Modal States
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false)
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false)
    const [logModelId, setLogModelId] = useState<string | null>(null)

    // Set default theme color to Gold on mount
    useEffect(() => {
        setThemeColor("#6f510bff")
    }, [setThemeColor])

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

                // enrich with feature columns
                modelsList = modelsList.map((model: Model) => {
                    // Try to find matching dataset (most recent one or by linking ID if available - here heuristics)
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

    // Smart metric display - shows the most relevant metric for each model type
    // All metrics displayed as user-friendly percentages
    const getMetricDisplay = (model: Model) => {
        const m = model.metrics || {}

        // Classification metrics (accuracy first)
        if (m.accuracy != null && !isNaN(m.accuracy)) {
            // Accuracy is 0-1, convert to percentage
            const pct = m.accuracy > 1 ? m.accuracy : m.accuracy * 100
            return `${pct.toFixed(1)}%`
        }

        // Clustering metrics (silhouette score) - show as percentage for simplicity
        // Silhouette ranges from -1 to 1, but positive values are good
        if (m.silhouette != null && !isNaN(m.silhouette)) {
            // Convert to percentage scale (e.g., 0.073 -> 7.3%)
            const pct = Math.abs(m.silhouette) * 100
            return `${pct.toFixed(1)}%`
        }

        // Regression metrics - R² as percentage, RMSE as-is
        if (m.r2 != null && !isNaN(m.r2)) {
            const pct = m.r2 * 100
            return `${pct.toFixed(1)}%`
        }
        if (m.rmse != null && !isNaN(m.rmse)) {
            return `${m.rmse.toFixed(2)}`
        }
        if (m.mae != null && !isNaN(m.mae)) {
            return `${m.mae.toFixed(2)}`
        }

        return "N/A"
    }

    // Get metric label based on model type - simplified for beginners
    const getMetricLabel = (model: Model) => {
        const m = model.metrics || {}
        if (m.accuracy != null) return "ACCURACY"
        if (m.silhouette != null) return "SCORE"  // Simplified label for clustering
        if (m.r2 != null) return "SCORE"
        if (m.rmse != null) return "ERROR"
        return "ACCURACY"
    }

    const handleOpenLogs = (modelId: string) => {
        setLogModelId(modelId)
        setIsLogsModalOpen(true)
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
                                        {/* Header with icon, title, and status */}
                                        <div className="p-5 pb-0">
                                            <div className="flex items-start justify-between mb-3">
                                                {/* Icon + Title Row */}
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}10)`,
                                                            boxShadow: `0 0 20px ${themeColor}20`
                                                        }}
                                                    >
                                                        <Rocket className="w-5 h-5 dark:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-lg font-bold text-white truncate">
                                                            {model.name || `${model.target_column} Model`}
                                                        </h3>
                                                        <p className="text-xs text-white/40">{model.algorithm}</p>
                                                    </div>
                                                </div>
                                                {/* Status Badge */}
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${model.status === 'deployed'
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
                                        </div>

                                        {/* Metrics Grid */}
                                        <div className="px-5 grid grid-cols-3 gap-2 mb-4">
                                            <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-center">
                                                <div className="text-[9px] text-white/40 uppercase tracking-wider">{getMetricLabel(model)}</div>
                                                <p className="text-sm font-bold" style={{ color: themeColor }}>{getMetricDisplay(model)}</p>
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

                                        {/* Actions Row */}
                                        <div className="px-5 flex gap-2 mb-4">
                                            <button
                                                onClick={() => handleOpenLogs(model.model_id)}
                                                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold text-white/70 flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Activity className="w-3.5 h-3.5" />
                                                Logs
                                            </button>
                                            {/* API Keys are global, but we show the button here for context/helper */}
                                            <button
                                                onClick={() => setIsApiKeyModalOpen(true)}
                                                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold text-white/70 flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Key className="w-3.5 h-3.5" />
                                                API Key
                                            </button>
                                        </div>

                                        {/* Footer with Owner Info */}
                                        <div className="px-5 pb-4 border-t border-white/5 pt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {(model.ownerPhotoURL || user?.photoURL) ? (
                                                    <img src={model.ownerPhotoURL || user?.photoURL || ''} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                                                        {(model.ownerName || user?.displayName || user?.email || 'U')[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-xs text-white/40 truncate max-w-[100px]">
                                                    {model.ownerName || user?.displayName || user?.email?.split('@')[0] || 'Owner'}
                                                </span>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${model.visibility === 'public'
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'bg-white/10 text-white/40'
                                                }`}>
                                                {model.visibility === 'public' ? 'Public' : 'Private'}
                                            </span>
                                        </div>

                                        {/* Main Action Button */}
                                        <button
                                            onClick={() => {
                                                setSelectedModel(model)
                                                setIsPredictModalOpen(true)
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white transition-all hover:brightness-110 border-t border-white/10"
                                            style={{ background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)` }}
                                        >
                                            <Play className="w-4 h-4" />
                                            {model.status === 'deployed' ? 'Test Endpoint' : 'Try in Browser'}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Prediction Modal */}
            {selectedModel && (
                <PredictionModal
                    isOpen={isPredictModalOpen}
                    onClose={() => setIsPredictModalOpen(false)}
                    model={selectedModel}
                    themeColor={themeColor}
                />
            )}

            {/* API Key Modal */}
            <ApiKeyModal
                isOpen={isApiKeyModalOpen}
                onClose={() => setIsApiKeyModalOpen(false)}
                themeColor={themeColor}
            />

            {/* Logs Modal */}
            {logModelId && (
                <LogsModal
                    isOpen={isLogsModalOpen}
                    onClose={() => setIsLogsModalOpen(false)}
                    modelId={logModelId}
                    themeColor={themeColor}
                />
            )}
        </>
    )
}
