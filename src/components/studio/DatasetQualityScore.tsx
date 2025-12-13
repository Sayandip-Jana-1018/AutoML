"use client"

import { motion } from "framer-motion"
import { Activity, AlertTriangle, CheckCircle2, XCircle, Database, Loader2 } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"

interface DatasetQualityProps {
    data: {
        totalRows: number
        totalColumns: number
        missingValues: number
        missingPercentage: number
        duplicateRows: number
        numericColumns: number
        categoricalColumns: number
        dateColumns: number
        highCardinalityColumns: string[]
        correlatedPairs: { col1: string; col2: string; correlation: number }[]
    } | null
    loading?: boolean
}

function getGrade(score: number): { grade: string; color: string; label: string } {
    if (score >= 90) return { grade: 'A+', color: '#22c55e', label: 'Excellent' }
    if (score >= 80) return { grade: 'A', color: '#22c55e', label: 'Great' }
    if (score >= 70) return { grade: 'B', color: '#84cc16', label: 'Good' }
    if (score >= 60) return { grade: 'C', color: '#eab308', label: 'Fair' }
    if (score >= 50) return { grade: 'D', color: '#f97316', label: 'Poor' }
    return { grade: 'F', color: '#ef4444', label: 'Needs Work' }
}

function calculateScore(data: DatasetQualityProps['data']): number {
    if (!data) return 0

    let score = 100

    // Penalize missing values (up to -30 points)
    score -= Math.min(data.missingPercentage * 3, 30)

    // Penalize duplicate rows (up to -20 points)
    const dupPercent = (data.duplicateRows / data.totalRows) * 100
    score -= Math.min(dupPercent * 2, 20)

    // Penalize high cardinality columns (up to -15 points)
    score -= Math.min(data.highCardinalityColumns.length * 3, 15)

    // Penalize highly correlated features (up to -15 points)
    const highCorrs = data.correlatedPairs.filter(p => Math.abs(p.correlation) > 0.9)
    score -= Math.min(highCorrs.length * 5, 15)

    // Bonus for balanced column types (+10 points)
    if (data.numericColumns > 0 && data.categoricalColumns > 0) {
        score += 5
    }

    // Bonus for reasonable size (+5 points)
    if (data.totalRows >= 100 && data.totalRows <= 1000000) {
        score += 5
    }

    return Math.max(0, Math.min(100, score))
}

export function DatasetQualityScore({ data, loading = false }: DatasetQualityProps) {
    const { themeColor } = useThemeColor()

    if (loading) {
        return (
            <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
                    <span className="text-white/60">Analyzing dataset quality...</span>
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="bg-black/20 border border-white/10 rounded-2xl p-8 text-center">
                <Database className="w-12 h-12 mx-auto text-white/30 mb-4" />
                <h3 className="font-bold text-white mb-2">No Dataset Loaded</h3>
                <p className="text-white/50 text-sm">Upload a dataset to analyze its quality</p>
            </div>
        )
    }

    const score = calculateScore(data)
    const { grade, color, label } = getGrade(score)

    const issues = []
    if (data.missingPercentage > 5) issues.push(`${data.missingPercentage.toFixed(1)}% missing values`)
    if (data.duplicateRows > 0) issues.push(`${data.duplicateRows} duplicate rows`)
    if (data.highCardinalityColumns.length > 0) issues.push(`${data.highCardinalityColumns.length} high-cardinality columns`)

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/20 border border-white/10 rounded-2xl p-6"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${themeColor}20` }}>
                    <Activity className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                    <h3 className="font-bold text-white">Dataset Quality Score</h3>
                    <p className="text-xs text-white/50">AI-powered data assessment</p>
                </div>
            </div>

            {/* Score Circle */}
            <div className="flex items-center justify-center mb-6">
                <div className="relative">
                    <svg className="w-32 h-32 -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r="56"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />
                        <motion.circle
                            cx="64"
                            cy="64"
                            r="56"
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 56}`}
                            initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - score / 100) }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black" style={{ color }}>{grade}</span>
                        <span className="text-xs text-white/50">{label}</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">{data.totalRows.toLocaleString()}</div>
                    <div className="text-xs text-white/50">Rows</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">{data.totalColumns}</div>
                    <div className="text-xs text-white/50">Columns</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">{data.numericColumns}</div>
                    <div className="text-xs text-white/50">Numeric</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">{data.categoricalColumns}</div>
                    <div className="text-xs text-white/50">Categorical</div>
                </div>
            </div>

            {/* Issues */}
            {issues.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-bold text-yellow-400">Attention Needed</span>
                    </div>
                    <ul className="text-xs text-white/60 space-y-1">
                        {issues.map((issue, i) => (
                            <li key={i}>• {issue}</li>
                        ))}
                    </ul>
                </div>
            )}

            {issues.length === 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-bold text-green-400">Dataset looks great!</span>
                    </div>
                </div>
            )}
        </motion.div>
    )
}
