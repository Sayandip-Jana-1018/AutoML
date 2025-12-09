"use client"

import { motion } from "framer-motion"
import { BrainCircuit, ChevronRight, Plus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface Model {
    id: string
    name: string
    type: string
    status: string
    accuracy?: number
}

interface ModelsGridProps {
    models: Model[]
    loading: boolean
    onViewAll?: () => void
}

export function ModelsGrid({ models, loading, onViewAll }: ModelsGridProps) {
    const router = useRouter()

    if (loading) {
        return (
            <div className="col-span-full flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
        )
    }

    if (models.length === 0) {
        return (
            <div className="col-span-full bg-transparent border border-black dark:border-white rounded-3xl p-10 text-center flex flex-col items-center justify-center border-dashed h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full flex items-center justify-center mb-4">
                    <BrainCircuit className="w-8 h-8 text-black dark:text-white/30" />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-2">No Models Found</h3>
                <p className="text-black/70 dark:text-white/50 max-w-md mx-auto mb-6 text-sm">
                    You haven't deployed any models yet. Start by training one in the Studio.
                </p>
                <button
                    onClick={() => router.push('/studio')}
                    className="px-6 py-2.5 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" /> Go to Studio
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
                    className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-5 rounded-3xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors group cursor-pointer"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div className={`w-2 h-2 rounded-full ${model.status === 'Deployed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    </div>
                    <h3 className="font-bold text-black dark:text-white text-lg mb-1 truncate">{model.name}</h3>
                    <div className="flex justify-between items-center">
                        <p className="text-black dark:text-white/50 text-sm">{model.type}</p>
                        {model.accuracy !== undefined && (
                            <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                                {(model.accuracy * 100).toFixed(1)}% Acc
                            </span>
                        )}
                    </div>
                </motion.div>
            ))}
            {models.length > 3 && onViewAll && (
                <button
                    onClick={onViewAll}
                    className="bg-black/5 dark:bg-white/5 border border-black dark:border-white p-5 rounded-3xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-3 group h-full min-h-[140px]"
                >
                    <div className="p-4 bg-black/10 dark:bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
                        <ChevronRight className="w-6 h-6 text-black dark:text-white" />
                    </div>
                    <span className="font-bold text-black dark:text-white text-sm">View All ({models.length})</span>
                </button>
            )}
        </>
    )
}
