"use client"

import { motion } from "framer-motion"
import { BarChart3, LineChart, PieChart, TrendingUp, Activity, AreaChart } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { NavButton } from "@/components/NavButton"

// Simple SVG Charts for visual effect
const MiniLineChart = ({ color }: { color: string }) => (
    <svg viewBox="0 0 100 40" className="w-full h-16">
        <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={color} stopOpacity="0.3" />
            </linearGradient>
        </defs>
        <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d="M0,35 Q15,30 25,25 T50,20 T75,10 T100,5"
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <motion.circle
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.5, duration: 0.3 }}
            cx="100" cy="5" r="3" fill={color}
        />
    </svg>
)

const MiniBarChart = ({ color }: { color: string }) => (
    <svg viewBox="0 0 100 40" className="w-full h-16">
        {[0, 1, 2, 3, 4].map((i) => (
            <motion.rect
                key={i}
                initial={{ height: 0, y: 40 }}
                whileInView={{ height: [20, 35, 15, 28, 32][i], y: 40 - [20, 35, 15, 28, 32][i] }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                x={i * 20 + 2}
                width="16"
                rx="2"
                fill={color}
                fillOpacity={0.3 + i * 0.15}
            />
        ))}
    </svg>
)

const MiniAreaChart = ({ color }: { color: string }) => (
    <svg viewBox="0 0 100 40" className="w-full h-16">
        <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.6" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
        </defs>
        <motion.path
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            d="M0,40 L0,30 Q20,25 40,28 T60,22 T80,18 T100,20 L100,40 Z"
            fill="url(#areaGradient)"
        />
        <motion.path
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            d="M0,30 Q20,25 40,28 T60,22 T80,18 T100,20"
            fill="none"
            stroke={color}
            strokeWidth="2"
        />
    </svg>
)

const MiniPieChart = ({ color }: { color: string }) => (
    <svg viewBox="0 0 40 40" className="w-16 h-16">
        <motion.circle
            initial={{ strokeDashoffset: 100 }}
            whileInView={{ strokeDashoffset: 25 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5 }}
            cx="20" cy="20" r="16"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray="100"
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            opacity="0.4"
        />
        <motion.circle
            initial={{ strokeDashoffset: 100 }}
            whileInView={{ strokeDashoffset: 60 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.3 }}
            cx="20" cy="20" r="16"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray="100"
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
        />
    </svg>
)

export function VisualizeSection() {
    const { themeColor } = useThemeColor()

    const charts = [
        { title: "Revenue Growth", type: "line", icon: TrendingUp, chart: MiniLineChart },
        { title: "Model Accuracy", type: "bar", icon: BarChart3, chart: MiniBarChart },
        { title: "Training Progress", type: "area", icon: Activity, chart: MiniAreaChart },
        { title: "Resource Usage", type: "pie", icon: PieChart, chart: MiniPieChart }
    ]

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20 py-20">
            <div className="max-w-7xl w-full mx-auto">
                {/* Content aligned to RIGHT side - laptop space on left */}
                <div className="flex justify-end">
                    {/* RIGHT: Header + Charts + Stats - takes half width on lg screens */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-8 w-full lg:w-1/2 text-right"
                    >
                        {/* Header */}
                        <div className="space-y-4">
                            {/* Decorative Line */}
                            <div className="flex items-center gap-4 mb-4 justify-end">
                                <div
                                    className="h-1 w-12 rounded-full"
                                    style={{ background: `linear-gradient(90deg, ${themeColor}, transparent)` }}
                                />
                                <LineChart className="w-5 h-5" style={{ color: themeColor }} />
                            </div>

                            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black">
                                <span
                                    className="bg-clip-text text-transparent"
                                    style={{
                                        backgroundImage: `linear-gradient(135deg, ${themeColor}, #fff, ${themeColor})`
                                    }}
                                >
                                    Visualize
                                </span>
                                <span className="text-foreground"> Your Data</span>
                            </h2>
                            <p className="text-base md:text-lg text-foreground/60 max-w-md ml-auto">
                                Real-time analytics and beautiful charts powered by AI.
                            </p>
                        </div>

                        {/* 2x2 Chart Grid */}
                        <div className="grid grid-cols-2 gap-3 max-w-md ml-auto">
                            {charts.map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: 0.1 * i }}
                                    whileHover={{ scale: 1.05, y: -5 }}
                                    className="group relative p-4 rounded-xl backdrop-blur-xl border border-white/20 hover:border-white/40 transition-all duration-500 overflow-hidden"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))',
                                        boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${themeColor}20, inset 0 1px 0 rgba(255,255,255,0.15)`
                                    }}
                                >
                                    {/* Glass shine effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60" />

                                    {/* Hover glow */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `radial-gradient(circle at center, ${themeColor}30, transparent 70%)`
                                        }}
                                    />

                                    <div className="relative z-10">
                                        {/* Icon */}
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300"
                                            style={{
                                                background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}15)`,
                                                boxShadow: `0 4px 15px ${themeColor}30`
                                            }}
                                        >
                                            <item.icon className="w-4 h-4" style={{ color: themeColor }} />
                                        </div>

                                        {/* Title */}
                                        <h3 className="text-xs font-bold text-white mb-2">{item.title}</h3>

                                        {/* Chart */}
                                        <div className="relative">
                                            <item.chart color={themeColor} />
                                        </div>
                                    </div>

                                    {/* Bottom Glow Line */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {/* Stats Row */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            className="flex gap-4 max-w-md ml-auto"
                        >
                            {[
                                { value: "99.9%", label: "Accuracy" },
                                { value: "50ms", label: "Latency" },
                                { value: "10M+", label: "Predictions" }
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className="flex-1 text-center p-3 rounded-lg backdrop-blur-sm border border-white/10"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
                                    }}
                                >
                                    <div
                                        className="text-lg md:text-xl font-black mb-0.5"
                                        style={{ color: themeColor }}
                                    >
                                        {stat.value}
                                    </div>
                                    <div className="text-[10px] text-foreground/50 uppercase tracking-wider">
                                        {stat.label}
                                    </div>
                                </div>
                            ))}
                        </motion.div>

                        {/* CTA Button */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                            className="flex justify-end"
                        >
                            <NavButton href="/visualize" variant="ghost" size="md" icon="arrow">
                                See Analytics
                            </NavButton>
                        </motion.div>
                    </motion.div>

                    {/* RIGHT: Space for MacBook (rendered via terminal-demo.tsx) */}
                    <div className="hidden lg:block relative h-[500px]">
                        {/* MacBook will be positioned here via 3D scroll animation */}
                    </div>
                </div>
            </div>
        </section>
    )
}
