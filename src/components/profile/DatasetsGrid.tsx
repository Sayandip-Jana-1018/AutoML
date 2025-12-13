"use client"

import { motion } from "framer-motion"
import { Database } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"

interface Dataset {
    id: string
    name: string
    status: string
    rowCount?: number
    type?: string
    projectId?: string
}

interface DatasetsGridProps {
    datasets: Dataset[]
}

export function DatasetsGrid({ datasets }: DatasetsGridProps) {
    const { themeColor } = useThemeColor()

    if (datasets.length === 0) return null

    return (
        <div className="mt-6">
            <h3 className="text-lg font-bold mb-4 flex items-center justify-center gap-2 text-black dark:text-white">
                <Database className="w-5 h-5" style={{ color: themeColor }} />
                Your Datasets ({datasets.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {datasets.slice(0, 4).map((ds, i) => (
                    <motion.div
                        key={ds.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4 rounded-xl flex items-center gap-3 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        style={{ borderColor: `${themeColor}30` }}
                    >
                        <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
                            <Database className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-black dark:text-white text-sm truncate">
                                {ds.name || 'Unnamed Dataset'}
                            </div>
                            <div className="text-xs text-black dark:text-white/50 flex items-center gap-2">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${ds.status === 'ready' ? 'bg-green-500' :
                                    ds.status === 'processing' ? 'bg-yellow-500' :
                                        ds.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                    }`} />
                                {ds.status || 'Unknown'}
                                {ds.rowCount ? ` • ${ds.rowCount.toLocaleString()} rows` : ''}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
            {datasets.length > 4 && (
                <button
                    className="mt-3 text-xs font-bold hover:opacity-80"
                    style={{ color: themeColor }}
                >
                    View all {datasets.length} datasets →
                </button>
            )}
        </div>
    )
}
