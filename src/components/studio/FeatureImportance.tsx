"use client"

import { motion } from "framer-motion"
import { BarChart3, TrendingUp } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"

interface FeatureImportanceProps {
    features: { name: string; importance: number }[]
    loading?: boolean
}

export function FeatureImportance({ features, loading = false }: FeatureImportanceProps) {
    const { themeColor } = useThemeColor()

    // Sort by importance descending
    const sortedFeatures = [...features].sort((a, b) => b.importance - a.importance)
    const maxImportance = Math.max(...features.map(f => f.importance), 0.01)

    if (loading) {
        return (
            <div className="bg-black/20 border border-white/10 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-white/10 rounded w-48 mb-6" />
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-8 bg-white/5 rounded mb-3" />
                ))}
            </div>
        )
    }

    if (features.length === 0) {
        return (
            <div className="bg-black/20 border border-white/10 rounded-2xl p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-white/30 mb-4" />
                <h3 className="font-bold text-white mb-2">No Feature Importance Data</h3>
                <p className="text-white/50 text-sm">Train a model to see which features matter most</p>
            </div>
        )
    }

    return (
        <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${themeColor}20` }}>
                    <TrendingUp className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                    <h3 className="font-bold text-white">Feature Importance</h3>
                    <p className="text-xs text-white/50">Which features impact predictions most</p>
                </div>
            </div>

            <div className="space-y-3">
                {sortedFeatures.slice(0, 10).map((feature, index) => {
                    const percentage = (feature.importance / maxImportance) * 100

                    return (
                        <motion.div
                            key={feature.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-white/80 truncate max-w-[150px]">
                                    {feature.name}
                                </span>
                                <span className="text-xs font-bold" style={{ color: themeColor }}>
                                    {(feature.importance * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.8, delay: index * 0.05 }}
                                    className="h-full rounded-full"
                                    style={{
                                        background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80)`
                                    }}
                                />
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {sortedFeatures.length > 10 && (
                <p className="text-xs text-white/40 mt-4 text-center">
                    Showing top 10 of {sortedFeatures.length} features
                </p>
            )}
        </div>
    )
}
