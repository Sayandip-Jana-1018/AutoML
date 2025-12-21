import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Loader2, Sparkles, Upload, Image as ImageIcon, FileUp, AlertCircle } from 'lucide-react';

interface PredictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    model: any;
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

    // Image prediction state
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isImageModel = model?.taskType === 'image_classification' ||
        model?.algorithm?.toLowerCase().includes('cnn') ||
        model?.algorithm?.toLowerCase().includes('resnet') ||
        model?.algorithm?.toLowerCase().includes('efficientnet') ||
        model?.algorithm?.toLowerCase().includes('mobilenet');

    useEffect(() => {
        if (isOpen && model) {
            if (!isImageModel) {
                fetchDatasetColumns()
            } else {
                setLoadingColumns(false); // No columns needed for image
            }
            setResult(null);
            setImagePreview(null);
            setFormData({});
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
                if (datasets.length > 0) {
                    const sortedDatasets = [...datasets].sort((a: any, b: any) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )

                    const dataset = sortedDatasets[0]
                    if (dataset.columns) {
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

    const handleImageUpload = (file: File) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setImagePreview(result);
            setFormData({ image: result }); // Store base64 in formData
            setResult(null);
        };
        reader.readAsDataURL(file);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    };

    const handlePredict = async () => {
        try {
            setLoading(true)
            setResult(null)

            let payloadData: any = {};

            if (isImageModel) {
                // Send base64 image
                payloadData = { image: formData.image };
            } else {
                // Send tabular data with numeric conversion
                Object.entries(formData).forEach(([key, value]) => {
                    const numValue = parseFloat(value)
                    payloadData[key] = isNaN(numValue) ? value : numValue
                })
            }

            const timestamp = Date.now()

            const res = await fetch('/api/proxy/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': timestamp.toString()
                },
                body: JSON.stringify({
                    model_id: model.model_id,
                    data: payloadData,
                    timestamp
                })
            })

            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || 'Prediction failed');
            }

            setResult(json)
        } catch (e: any) {
            console.error('Prediction error:', e)
            setResult({ error: e.message || 'Request Failed' })
        } finally {
            setLoading(false)
        }
    }

    const isModelReady = model.status === 'deployed' || model.status === 'ready' || featureColumns.length > 0 || isImageModel;
    const canPredict = isImageModel ? !!imagePreview : (featureColumns.length > 0 && !Object.values(formData).some(v => !v));

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
                                {model.metrics?.accuracy && (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold border" style={{ background: `${themeColor}20`, borderColor: `${themeColor}40`, color: themeColor }}>
                                        Accuracy: {(model.metrics.accuracy * 100).toFixed(1)}%
                                    </span>
                                )}
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${model.status === 'deployed'
                                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                    : 'bg-white/5 border-white/10 text-white/50'
                                    } border`}>
                                    {model.status === 'deployed' ? '● Live' : model.status || 'Ready'}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 pt-0 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {!isModelReady ? (
                                <div className="text-center py-8 px-4 bg-white/5 rounded-2xl border border-white/5 mb-4">
                                    <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${themeColor}20` }}>
                                        <Loader2 className="w-6 h-6 animate-pulse" style={{ color: themeColor }} />
                                    </div>
                                    <p className="text-white/60 font-medium mb-1">Model Not Yet Ready</p>
                                    <p className="text-xs text-white/40">Please wait for successful deployment</p>
                                </div>
                            ) : loadingColumns ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
                                </div>
                            ) : isImageModel ? (
                                /* === IMAGE UPLOADER UI === */
                                <div className="space-y-6">
                                    {!imagePreview ? (
                                        <div
                                            className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer group ${isDragging
                                                ? 'border-white bg-white/10 scale-[1.02]'
                                                : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                                                }`}
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={onDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            style={isDragging ? { borderColor: themeColor } : {}}
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                            />
                                            <div className="w-20 h-20 rounded-full bg-white/5 mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <ImageIcon className="w-10 h-10 text-white/40 group-hover:text-white" />
                                            </div>
                                            <h3 className="text-lg font-medium text-white mb-2">Upload Image to Predict</h3>
                                            <p className="text-sm text-white/40 mb-6">Drag & drop or click to browse</p>

                                            <div className="flex justify-center gap-4">
                                                <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-white/40">supports .jpg</span>
                                                <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-white/40">supports .png</span>
                                                <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-white/40">auto-resizing</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative rounded-3xl overflow-hidden bg-black/40 border border-white/10 group">
                                            <div className="absolute top-4 right-4 z-20">
                                                <button
                                                    onClick={() => setImagePreview(null)}
                                                    className="p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="aspect-video relative flex items-center justify-center bg-black/20">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            </div>
                                            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-between items-center">
                                                <span className="text-xs text-white/60 font-medium">Ready for inference</span>
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1"
                                                >
                                                    <Upload className="w-3 h-3" /> Change Image
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* === TABULAR INPUT UI === */
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
                            )}

                            {/* Result Display */}
                            {result && (
                                <div className="mt-6 p-6 rounded-2xl border relative overflow-hidden"
                                    style={{
                                        background: result.error ? 'rgba(239,68,68,0.1)' : `${themeColor}15`,
                                        borderColor: result.error ? 'rgba(239,68,68,0.3)' : `${themeColor}30`
                                    }}>

                                    {result.error ? (
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-full bg-red-500/20 text-red-400">
                                                <AlertCircle className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-red-400 mb-1">Prediction Failed</h4>
                                                <p className="text-xs text-white/60">{result.error}</p>
                                                {result.details && <pre className="mt-2 p-2 bg-black/30 rounded-lg text-[10px] font-mono text-white/50 overflow-x-auto">{result.details}</pre>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center relative z-10">
                                            <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">
                                                {model.target_column ? `Predicted ${model.target_column}` : 'Prediction Result'}
                                            </p>

                                            <div className="flex items-center justify-center gap-2 mb-3">
                                                <p className="text-5xl font-black tracking-tight" style={{ color: themeColor }}>
                                                    {typeof result.prediction === 'number'
                                                        ? result.prediction.toFixed(4).replace(/\.?0+$/, '')
                                                        : result.prediction}
                                                </p>
                                            </div>

                                            {result.probability && (
                                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 border border-white/10 backdrop-blur-sm">
                                                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                                                    <p className="text-sm font-medium text-white">{(result.probability * 100).toFixed(1)}% Confidence</p>
                                                </div>
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
                                disabled={loading || !isModelReady || !canPredict}
                                className="w-full py-4 rounded-xl font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:brightness-110 border shadow-lg relative overflow-hidden group"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}60, ${themeColor}30)`,
                                    borderColor: `${themeColor}50`
                                }}
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <div className="relative flex items-center justify-center gap-2">
                                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                                        <>
                                            {isModelReady && canPredict && <Sparkles className="w-4 h-4" />}
                                            <span>
                                                {loading ? 'Processing...' :
                                                    !isModelReady ? "Deploy Model First" :
                                                        !canPredict ? (isImageModel ? "Upload Image First" : "Fill Inputs First") :
                                                            "Run Prediction"}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
