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
    algorithm?: string
    target_column?: string
    projectId?: string
}

interface ModelsGridProps {
    models: Model[]
    loading: boolean
    onViewAll?: () => void
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
                        {model.algorithm || model.type || 'ML Model'}
                    </p>
                    <div className="flex justify-between items-center">
                        <span
                            className="text-sm font-bold px-3 py-1.5 rounded-lg"
                            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                        >
                            {model.accuracy !== undefined ? `${(model.accuracy * 100).toFixed(1)}% Accuracy` : 'Training...'}
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
