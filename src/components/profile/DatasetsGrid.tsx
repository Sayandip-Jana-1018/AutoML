"use client"

import { motion } from "framer-motion"
import { Database } from "lucide-react"

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
    if (datasets.length === 0) return null

    return (
        <div className="mt-6">
            <h3 className="text-sm font-bold text-black dark:text-white/60 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4" /> Your Datasets ({datasets.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {datasets.slice(0, 4).map((ds, i) => (
                    <motion.div
                        key={ds.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-3 rounded-xl flex items-center gap-3 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Database className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-black dark:text-white text-sm truncate">
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
                <button className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-medium">
                    View all {datasets.length} datasets →
                </button>
            )}
        </div>
    )
}
