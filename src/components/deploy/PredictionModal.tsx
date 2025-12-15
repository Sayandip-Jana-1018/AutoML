
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Loader2, Sparkles } from 'lucide-react';

interface PredictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    model: any; // Type 'Model' can be imported or defined more strictly if shared
    themeColor: string;
}

export const PredictionModal = ({ isOpen, onClose, model, themeColor }: PredictionModalProps) => {
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
                    const sortedDatasets = [...datasets].sort((a: any, b: any) =>
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
            sample[col] = String(Math.floor(Math.random() * 100) + 1)
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
                        className="relative w-full max-w-5xl max-h-[85vh] bg-black/60 backdrop-blur-2xl border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
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

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
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
        </ AnimatePresence>
    );
};
