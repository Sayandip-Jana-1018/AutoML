"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import GradientBlinds from "@/components/PrismaticBurst"
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Play, Settings, Database } from "lucide-react"
import { GlassSelect } from "@/components/ui/glass-select"

// Types
interface DatasetResponse {
    dataset_id: string
    columns: string[]
    message?: string
}

interface JobStatus {
    status: string
    progress: number
    result?: any
    error?: string
}

export default function StudioPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const [step, setStep] = useState(1)

    // Form States
    const [file, setFile] = useState<File | null>(null)
    const [datasetName, setDatasetName] = useState("")
    const [datasetInfo, setDatasetInfo] = useState<DatasetResponse | null>(null)
    const [targetColumn, setTargetColumn] = useState("")
    const [algorithm, setAlgorithm] = useState("auto")
    const [jobId, setJobId] = useState<string | null>(null)
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
    const [error, setError] = useState("")

    // Set default theme color to Gold on mount
    useEffect(() => {
        setThemeColor("#bebebeff")
    }, [setThemeColor])

    // Poll job status
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (jobId && step === 3) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/proxy/jobs/${jobId}`)
                    if (res.ok) {
                        const status: JobStatus = await res.json()
                        setJobStatus(status)
                        if (status.status === 'completed') {
                            clearInterval(interval)
                        } else if (status.status === 'failed') {
                            clearInterval(interval)
                            setError(status.error || 'Training failed')
                        }
                    }
                } catch (e) {
                    console.error(e)
                }
            }, 2000)
        }
        return () => clearInterval(interval)
    }, [jobId, step])


    const [cleaningProgress, setCleaningProgress] = useState<string>("")
    const [cleaningSummary, setCleaningSummary] = useState<any>(null)

    const handleUpload = async () => {
        if (!file || !datasetName) return
        setError("")
        setCleaningProgress("Analyzing data with AI...")

        try {
            // Step 1: Clean data with AI
            const cleanFormData = new FormData()
            cleanFormData.append('file', file)

            setCleaningProgress("AI is analyzing your dataset...")
            const cleanRes = await fetch('/api/clean-data', {
                method: 'POST',
                body: cleanFormData
            })

            if (!cleanRes.ok) {
                console.warn('AI cleaning failed, uploading original data')
                setCleaningProgress("")
            }

            let fileToUpload = file
            let cleaningInfo = null

            if (cleanRes.ok) {
                const cleanData = await cleanRes.json()
                cleaningInfo = {
                    original_rows: cleanData.original_rows,
                    cleaned_rows: cleanData.cleaned_rows,
                    issues: cleanData.issues,
                    summary: cleanData.summary
                }
                setCleaningSummary(cleaningInfo)

                // Create cleaned file
                const cleanedBlob = new Blob([cleanData.cleaned_data], { type: 'text/csv' })
                fileToUpload = new File([cleanedBlob], file.name, { type: 'text/csv' })

                setCleaningProgress(`✓ Data cleaned: ${cleanData.issues?.length || 0} issues fixed`)
            }

            // Step 2: Upload to backend
            setCleaningProgress("Uploading to AWS...")
            const formData = new FormData()
            formData.append('file', fileToUpload)
            formData.append('name', datasetName)

            const res = await fetch('/api/proxy/upload', { method: 'POST', body: formData })
            if (!res.ok) throw new Error('Upload failed')
            const data = await res.json()
            setDatasetInfo(data)
            setCleaningProgress("")
            setStep(2)
        } catch (e) {
            setError("Upload failed. Please check your file.")
            setCleaningProgress("")
        }
    }

    const handleTrain = async () => {
        if (!datasetInfo || !targetColumn) return
        setError("")
        const payload = {
            dataset_id: datasetInfo.dataset_id,
            target_column: targetColumn,
            algorithm,
            test_size: 0.2
        }
        console.log("Starting training with payload:", payload)

        try {
            const res = await fetch('/api/proxy/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) throw new Error('Training start failed')
            const data = await res.json()
            setJobId(data.job_id)
            setStep(3)
        } catch (e) {
            setError("Failed to start training.")
        }
    }

    return (
        <main className="min-h-screen relative overflow-hidden bg-background selection:bg-primary/30 flex flex-col transition-colors duration-300">

            {/* Top Right Theme Toggle */}
            <div className="fixed top-0 right-0 z-50">
                <ThemeToggle />
            </div>

            {/* Navbar */}
            <div className="relative z-40">
                <Navbar />
            </div>

            {/* Studio Content */}
            <div className="relative w-full flex-1 flex flex-col items-center justify-start pt-32 pb-20 overflow-hidden min-h-screen">
                {/* Gradient Blinds Background */}
                <div className="absolute inset-0 w-full h-full z-0 [mask-image:linear-gradient(to_bottom,transparent,black_10%)]">
                    <GradientBlinds
                        gradientColors={themeColor === '#ffffff'
                            ? ['#e0e0e0', '#ffffff', '#f5f5f5']
                            : [themeColor, themeColor, themeColor]}
                        angle={45}
                        noise={0.2}
                        blindCount={3}
                        blindMinWidth={50}
                        spotlightRadius={0.9}
                        spotlightSoftness={0.6}
                        spotlightOpacity={1.0}
                        mouseDampening={0}
                        distortAmount={0.2}
                        shineDirection="left"
                        mixBlendMode={themeColor === '#ffffff' ? 'multiply' : 'screen'}
                    />
                </div>

                {/* Content */}
                <div className="relative z-10 w-full px-6 flex flex-col items-center max-w-4xl mx-auto">
                    <div className="mb-12 text-center">
                        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight drop-shadow-2xl">
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                                Studio
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
                            Build and train your custom AI models.
                        </p>
                    </div>

                    {/* Stepper */}
                    <div className="w-full flex items-center justify-between mb-12 relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -z-10 rounded-full" />
                        <div className="absolute top-1/2 left-0 h-1 bg-white -z-10 rounded-full transition-all duration-500"
                            style={{ width: `${((step - 1) / 2) * 100}%`, background: themeColor }} />

                        {[
                            { n: 1, label: "Upload", icon: Database },
                            { n: 2, label: "Configure", icon: Settings },
                            { n: 3, label: "Train", icon: Play }
                        ].map((s) => (
                            <div key={s.n} className="flex flex-col items-center gap-2">
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${step >= s.n ? 'bg-black border-transparent shadow-lg' : 'bg-black/40 border-white/20'
                                        }`}
                                    style={{ borderColor: step >= s.n ? themeColor : undefined }}
                                >
                                    <s.icon className={`w-5 h-5 ${step >= s.n ? 'text-white' : 'text-white/40'}`} />
                                </div>
                                <span className={`text-xs font-bold ${step >= s.n ? 'text-white' : 'text-white/40'}`}>{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Main Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                    >
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl mb-6 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <label className="block text-sm font-bold text-white/80 mb-2">Dataset Name</label>
                                        <input
                                            type="text"
                                            value={datasetName}
                                            onChange={e => setDatasetName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-white/30 transition-all"
                                            placeholder="e.g., Customer Churn Data"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-white/80 mb-2">CSV File</label>
                                        <div className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:bg-white/5 transition-colors cursor-pointer relative group">
                                            <input
                                                type="file"
                                                accept=".csv"
                                                onChange={e => setFile(e.target.files?.[0] || null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <Upload className="w-8 h-8 text-white/40" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-white">{file ? file.name : "Drop your CSV here"}</p>
                                                    <p className="text-sm text-white/40 mt-1">or click to browse</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cleaning Progress */}
                                    {cleaningProgress && (
                                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-200 p-4 rounded-xl flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> {cleaningProgress}
                                        </div>
                                    )}

                                    {/* Cleaning Summary */}
                                    {cleaningSummary && (
                                        <div className="bg-green-500/10 border border-green-500/20 text-green-200 p-4 rounded-xl">
                                            <p className="font-bold mb-2">✓ AI Data Cleaning Complete</p>
                                            <p className="text-sm text-green-300/80">{cleaningSummary.summary}</p>
                                            <div className="mt-2 text-xs text-green-300/60">
                                                <span>Rows: {cleaningSummary.original_rows} → {cleaningSummary.cleaned_rows}</span>
                                                {cleaningSummary.issues?.length > 0 && (
                                                    <span className="ml-3">Issues fixed: {cleaningSummary.issues.length}</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleUpload}
                                        disabled={!file || !datasetName || !!cleaningProgress}
                                        className="w-full py-4 rounded-xl font-bold text-black text-lg mt-4 disabled:opacity-50 hover:scale-[1.02] transition-all shadow-lg"
                                        style={{ background: themeColor }}
                                    >
                                        {cleaningProgress ? 'Processing...' : 'Upload & Continue'}
                                    </button>
                                </motion.div>
                            )}

                            {step === 2 && datasetInfo && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {datasetInfo.message && (
                                        <div className="bg-green-500/10 border border-green-500/20 text-green-200 p-4 rounded-xl flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> {datasetInfo.message}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-bold text-white/80 mb-2">Target Column (Prediction Goal)</label>
                                        <div className="relative">
                                            <GlassSelect
                                                options={datasetInfo.columns.map(col => ({ value: col, label: col }))}
                                                value={targetColumn}
                                                onChange={setTargetColumn}
                                                placeholder="Select Target Column"
                                                themeColor={themeColor}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-white/80 mb-2">Algorithm</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'auto', name: 'AutoML (Best)' },
                                                { id: 'random_forest', name: 'Random Forest' },
                                                { id: 'xgboost', name: 'XGBoost' },
                                                { id: 'logistic_regression', name: 'Logistic Reg' }
                                            ].map((algo) => (
                                                <button
                                                    key={algo.id}
                                                    onClick={() => setAlgorithm(algo.id)}
                                                    className={`p-4 rounded-xl border text-left transition-all ${algorithm === algo.id
                                                        ? 'bg-white/10 border-white/40'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                        }`}
                                                >
                                                    <span className="font-bold text-sm block">{algo.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleTrain}
                                        disabled={!targetColumn}
                                        className="w-full py-4 rounded-xl font-bold text-black text-lg mt-4 disabled:opacity-50 hover:scale-[1.02] transition-all shadow-lg"
                                        style={{ background: themeColor }}
                                    >
                                        Start Training
                                    </button>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="text-center py-12"
                                >
                                    {jobStatus?.status === 'completed' ? (
                                        <>
                                            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                                                <CheckCircle className="w-12 h-12 text-green-500" />
                                            </div>
                                            <h3 className="text-3xl font-bold text-white mb-4">Training Complete!</h3>
                                            <p className="text-white/60 mb-8 max-w-md mx-auto">
                                                Your model has been successfully trained and is now ready for deployment.
                                            </p>
                                            <div className="flex gap-4 justify-center">
                                                <a href="/deploy" className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all">
                                                    Go to Deployments
                                                </a>
                                                <a href="/chat" className="px-8 py-3 rounded-xl font-bold text-black transition-all hover:scale-105 shadow-lg" style={{ background: themeColor }}>
                                                    Chat with Model
                                                </a>
                                            </div>
                                        </>
                                    ) : jobStatus?.status === 'failed' ? (
                                        <>
                                            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                                                <AlertCircle className="w-12 h-12 text-red-500" />
                                            </div>
                                            <h3 className="text-3xl font-bold text-white mb-4">Training Failed</h3>
                                            <p className="text-white/60 mb-4">{error}</p>
                                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-8 text-sm text-white/50 max-w-md mx-auto">
                                                <p className="font-bold text-white/70 mb-1">Troubleshooting Tips:</p>
                                                <ul className="list-disc list-inside space-y-1 text-left">
                                                    <li>Ensure your dataset has at least 50 rows.</li>
                                                    <li>Do not select "ID" or unique identifier columns as the target.</li>
                                                    <li>Check if the target column has valid values (not all null).</li>
                                                </ul>
                                            </div>
                                            <button
                                                onClick={() => setStep(2)}
                                                className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                                            >
                                                Try Again
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="relative w-24 h-24 mx-auto mb-8">
                                                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                                                <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${themeColor} transparent transparent transparent` }} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-sm font-bold">{jobStatus?.progress || 0}%</span>
                                                </div>
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-2">Training in Progress...</h3>
                                            <p className="text-white/60 mb-8">Optimizing model parameters</p>
                                            <div className="w-full max-w-md mx-auto bg-white/10 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="h-full transition-all duration-500 ease-out"
                                                    style={{ width: `${jobStatus?.progress || 0}%`, background: themeColor }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

        </main>
    )
}
