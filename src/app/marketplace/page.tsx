"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import ColorBends from "@/components/ColorBends"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSession } from "next-auth/react"
import {
    Rocket, Copy, CheckCircle, ExternalLink, Plus, X, Loader2, Sparkles, TrendingUp, Calendar
} from "lucide-react"

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
    feature_columns: string[]
    created_at: string
    user_email?: string
}

export default function MarketplacePage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const { data: session } = useSession()
    const [models, setModels] = useState<Model[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedModel, setSelectedModel] = useState<Model | null>(null)
    const [showUrlModal, setShowUrlModal] = useState(false)
    const [urlCopied, setUrlCopied] = useState(false)

    useEffect(() => {
        setThemeColor("#10B981") // Green theme for marketplace
    }, [setThemeColor])

    const fetchModels = async () => {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

            const res = await fetch('/api/proxy/models', { signal: controller.signal })
            clearTimeout(timeoutId)

            if (res.ok) {
                const data = await res.json()
                let modelsList = data.models || []

                // Filter models by user email if available
                if (session?.user?.email) {
                    modelsList = modelsList.filter((m: any) => m.user_email === session.user?.email)
                }

                setModels(modelsList)
            } else {
                console.error('Failed to fetch models:', res.status)
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error('Request timeout - backend may be down')
            } else {
                console.error("Failed to fetch models", error)
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchModels()
    }, [])

    const getAccuracy = (model: Model) => {
        const acc = model.metrics?.accuracy
        if (acc === undefined || acc === null || isNaN(acc)) return "N/A"
        return `${(acc * 100).toFixed(1)}%`
    }

    const copyApiUrl = (modelId: string) => {
        const url = `https://api.Healthy.ai/predict/${modelId}`
        navigator.clipboard.writeText(url)
        setUrlCopied(true)
        setTimeout(() => setUrlCopied(false), 2000)
    }

    const handleDeployNew = (model: Model) => {
        // Redirect to studio with pre-filled config
        const config = {
            algorithm: model.algorithm,
            target: model.target_column
        }
        window.location.href = `/studio?config=${encodeURIComponent(JSON.stringify(config))}`
    }

    return (
        <>
            <div className="fixed inset-0 bg-black" style={{ zIndex: 0 }}>
                <ColorBends
                    colors={[themeColor, themeColor, themeColor]}
                    speed={0.3}
                    scale={1.2}
                    warpStrength={1.2}
                    frequency={1.2}
                    autoRotate={0.05}
                />
            </div>

            <div className="fixed top-0 right-0 z-50"><ThemeToggle /></div>
            <div className="relative z-40"><Navbar /></div>

            <main className="relative z-10 min-h-screen p-6 pt-24 pb-12">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
                                Model Marketplace
                            </span>
                        </h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            Browse, deploy, and share your trained AI models
                        </p>
                    </motion.div>

                    {/* Models Grid */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                        </div>
                    ) : models.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-white/40 mb-4">No models in marketplace yet.</p>
                            <a href="/studio" className="px-6 py-3 rounded-xl font-bold text-black transition-all hover:scale-105 shadow-lg inline-block" style={{ background: themeColor }}>
                                Train Your First Model
                            </a>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {models.map((model, index) => (
                                <motion.div
                                    key={model.model_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="group relative"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl transition-all duration-300 group-hover:opacity-100 opacity-80" />
                                    <div className="relative bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all duration-300 group-hover:-translate-y-1">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}10)`,
                                                        boxShadow: `0 0 20px ${themeColor}20`
                                                    }}
                                                >
                                                    <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white">{model.target_column}</h3>
                                                    <p className="text-xs text-white/40">{model.algorithm}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metrics */}
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <TrendingUp className="w-3 h-3 text-white/40" />
                                                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Accuracy</span>
                                                </div>
                                                <p className="text-lg font-bold text-white">{getAccuracy(model)}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Calendar className="w-3 h-3 text-white/40" />
                                                    <span className="text-[10px] text-white/40 uppercase tracking-wider">Created</span>
                                                </div>
                                                <p className="text-xs font-bold text-white">
                                                    {new Date(model.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Features */}
                                        <div className="mb-4">
                                            <p className="text-xs text-white/40 mb-2">Features: {model.feature_columns?.length || 0}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {model.feature_columns?.slice(0, 3).map((col, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/60">
                                                        {col}
                                                    </span>
                                                ))}
                                                {model.feature_columns?.length > 3 && (
                                                    <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/60">
                                                        +{model.feature_columns.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedModel(model)
                                                    setShowUrlModal(true)
                                                }}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white transition-all hover:brightness-110 shadow-lg text-sm"
                                                style={{ background: `linear-gradient(135deg, ${themeColor}80, ${themeColor}40)` }}
                                            >
                                                <ExternalLink className="w-4 h-4" /> Get API URL
                                            </button>
                                            <button
                                                onClick={() => handleDeployNew(model)}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all text-sm"
                                            >
                                                <Plus className="w-4 h-4" /> Deploy New Model
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* API URL Modal */}
            <AnimatePresence>
                {showUrlModal && selectedModel && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowUrlModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl"
                        >
                            <button
                                onClick={() => setShowUrlModal(false)}
                                className="absolute top-4 right-4 text-white/40 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-2">API Endpoint</h2>
                            <p className="text-white/50 text-sm mb-6">
                                Use this URL to access your model from any application
                            </p>

                            <div className="bg-black/30 border border-white/10 rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-white/40">Prediction Endpoint</span>
                                    <button
                                        onClick={() => copyApiUrl(selectedModel.model_id)}
                                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all hover:brightness-110"
                                        style={{ background: urlCopied ? '#10B981' : `${themeColor}40`, color: urlCopied ? 'white' : themeColor }}
                                    >
                                        {urlCopied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {urlCopied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <code className="text-sm text-white/80 font-mono break-all">
                                    https://api.Healthy.ai/predict/{selectedModel.model_id}
                                </code>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <p className="text-xs text-white/60 mb-2 font-bold">Example Usage (cURL):</p>
                                <code className="text-xs text-white/50 font-mono block whitespace-pre-wrap">
                                    {`curl -X POST https://api.Healthy.ai/predict/${selectedModel.model_id} \\
  -H "Content-Type: application/json" \\
  -d '{"data": {...}}'`}
                                </code>
                            </div>

                            <p className="text-xs text-white/30 mt-4 text-center">
                                * API hosting coming soon. This is a preview URL.
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}
