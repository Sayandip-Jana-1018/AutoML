"use client"

import { motion } from "framer-motion"
import { BrainCircuit, ChevronRight, Plus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useThemeColor } from "@/context/theme-context"

interface Model {
    id: string
    name: string
    type: string
    status: string
    accuracy?: number
    silhouette?: number  // Clustering metric
    r2?: number          // Regression metric
    algorithm?: string
    target_column?: string
    projectId?: string
    algorithm_comparison?: any[] // Benchmark comparison from AutoML
}

interface ModelsGridProps {
    models: Model[]
    loading: boolean
    onViewAll?: () => void
}

// Helper to find the best model from algorithm_comparison benchmark
function getBestFromBenchmark(model: Model): { algorithm: string, score: number } | null {
    const comparison = model.algorithm_comparison
    if (!comparison) return null

    // Handle both array and object formats
    let comparisonArray: any[] = []
    if (Array.isArray(comparison)) {
        comparisonArray = comparison
    } else if (typeof comparison === 'object') {
        // Convert object format to array (e.g., {RandomForest: {cv_score: 0.82}} -> [{algorithm: 'RandomForest', cv_score: 0.82}])
        comparisonArray = Object.entries(comparison).map(([name, data]: [string, any]) => ({
            algorithm: name,
            name: name,
            cv_score: data.cv_score ?? data.mean ?? data.score ?? 0,
            mean: data.mean ?? data.cv_score ?? 0
        }))
    }

    if (comparisonArray.length === 0) return null

    // Find the best performing algorithm
    let best = comparisonArray[0];
    for (const alg of comparisonArray) {
        const currentScore = alg.mean ?? alg.cv_score ?? alg.score ?? 0;
        const bestScore = best.mean ?? best.cv_score ?? best.score ?? 0;
        if (currentScore > bestScore) {
            best = alg;
        }
    }
    return {
        algorithm: best.algorithm || best.name || 'Unknown',
        score: best.mean ?? best.cv_score ?? best.score ?? 0
    };
}

// Helper to display the most relevant metric for any model type
function getMetricDisplay(model: Model): { metric: string, algorithm?: string } {
    // First check for benchmark comparison data - show best model from there
    const best = getBestFromBenchmark(model);
    if (best && best.score > 0) {
        const pct = best.score > 1 ? best.score : best.score * 100;
        return { metric: `${pct.toFixed(2)}% Accuracy`, algorithm: best.algorithm };
    }

    // Fallback to direct metrics if no benchmark data
    // Classification - accuracy
    if (model.accuracy != null && !isNaN(model.accuracy)) {
        const pct = model.accuracy > 1 ? model.accuracy : model.accuracy * 100;
        return { metric: `${pct.toFixed(1)}% Accuracy` };
    }
    // Clustering - silhouette score
    if (model.silhouette != null && !isNaN(model.silhouette)) {
        const pct = Math.abs(model.silhouette) * 100;
        return { metric: `${pct.toFixed(1)}% Score` };
    }
    // Regression - R² score
    if (model.r2 != null && !isNaN(model.r2)) {
        const pct = model.r2 * 100;
        return { metric: `${pct.toFixed(1)}% R²` };
    }
    return { metric: 'Training...' };
}

export function ModelsGrid({ models, loading, onViewAll }: ModelsGridProps) {
    const router = useRouter()
    const { themeColor } = useThemeColor()

    if (loading) {
        return (
            <div className="col-span-full flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
            </div>
        )
    }

    if (models.length === 0) {
        return (
            <div
                className="col-span-full bg-transparent border-2 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center h-full"
                style={{ borderColor: `${themeColor}40` }}
            >
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${themeColor}20` }}
                >
                    <BrainCircuit className="w-10 h-10" style={{ color: themeColor }} />
                </div>
                <h3 className="text-2xl font-bold text-black dark:text-white mb-2">No Models Found</h3>
                <p className="text-black/70 dark:text-white/50 max-w-md mx-auto mb-6">
                    You haven't deployed any models yet. Start by training one in the Studio.
                </p>
                <button
                    onClick={() => router.push('/studio')}
                    className="px-8 py-3 rounded-full font-bold hover:opacity-90 transition-colors flex items-center gap-2 text-white"
                    style={{ backgroundColor: themeColor }}
                >
                    <Plus className="w-5 h-5" /> Go to Studio
                </button>
            </div>
        )
    }

    return (
        <>
            {models.slice(0, 3).map((model, i) => (
                <motion.div
                    key={model.id || i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-6 rounded-3xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors group cursor-pointer"
                    style={{ borderColor: `${themeColor}30` }}
                    onClick={() => model.projectId && router.push(`/deploy?model=${model.id}`)}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div
                            className="p-4 rounded-2xl group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: `${themeColor}20` }}
                        >
                            <BrainCircuit className="w-7 h-7" style={{ color: themeColor }} />
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full ${model.status === 'Deployed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    </div>
                    <h3 className="font-bold text-2xl mb-1 truncate text-black dark:text-white">
                        {model.name || 'Trained Model'}
                    </h3>
                    <p className="text-black/60 dark:text-white/50 text-sm mb-3">
                        {/* Show best algorithm from benchmark if available, otherwise show registered algorithm */}
                        {getMetricDisplay(model).algorithm || model.algorithm || model.type || 'ML Model'}
                    </p>
                    <div className="flex justify-between items-center">
                        <span
                            className="text-sm font-bold px-3 py-1.5 rounded-lg"
                            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                        >
                            {getMetricDisplay(model).metric}
                        </span>
                    </div>
                </motion.div>
            ))}
            {models.length > 3 && onViewAll && (
                <button
                    onClick={onViewAll}
                    className="bg-black/5 dark:bg-white/5 border-2 border-dashed p-6 rounded-3xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-3 group h-full min-h-[180px]"
                    style={{ borderColor: `${themeColor}40` }}
                >
                    <div
                        className="p-5 rounded-full group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${themeColor}20` }}
                    >
                        <ChevronRight className="w-7 h-7" style={{ color: themeColor }} />
                    </div>
                    <span className="font-bold text-black dark:text-white">View All ({models.length})</span>
                </button>
            )}
        </>
    )
}
