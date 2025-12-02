"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Settings, Activity, Database, Cpu, Save, ChevronDown, Layers, Zap, Clock, Check } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { cn } from "@/lib/utils"

interface CustomSelectProps {
    options: string[]
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
}

function CustomSelect({ options, value, onChange, placeholder }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [selected, setSelected] = useState(value || options[0])
    const { themeColor } = useThemeColor()
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const handleSelect = (option: string) => {
        setSelected(option)
        onChange?.(option)
        setIsOpen(false)
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm flex items-center justify-between focus:outline-none focus:border-white/30 transition-all hover:bg-black/50"
            >
                <span className="truncate">{selected}</span>
                <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#0f0f12] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-60 overflow-y-auto"
                    >
                        {options.map((option) => (
                            <button
                                key={option}
                                onClick={() => handleSelect(option)}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center justify-between group transition-colors"
                            >
                                <span className={cn(option === selected ? "text-white font-medium" : "text-muted-foreground group-hover:text-white")}>
                                    {option}
                                </span>
                                {option === selected && (
                                    <Check className="w-4 h-4" style={{ color: themeColor }} />
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function TrainingDashboard() {
    const { themeColor } = useThemeColor()
    const [isTraining, setIsTraining] = useState(false)

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

                {/* Left Column: Configuration */}
                <div className="lg:col-span-8 flex flex-col gap-8 h-full">

                    {/* Header Card */}
                    <div className="relative overflow-visible rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl p-8 shadow-2xl flex-1 flex flex-col">
                        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                            <Settings className="w-24 h-24" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Model Configuration</h2>
                        <p className="text-muted-foreground mb-8 max-w-md">Customize your model architecture and training parameters for optimal performance.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 flex-1">
                            <div className="space-y-2 group">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-3 h-3" /> Architecture
                                </label>
                                <CustomSelect
                                    options={[
                                        "Transformer (GPT-4 Style)",
                                        "ResNet-50",
                                        "BERT Large",
                                        "Stable Diffusion XL"
                                    ]}
                                />
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Zap className="w-3 h-3" /> Optimizer
                                </label>
                                <CustomSelect
                                    options={[
                                        "AdamW",
                                        "SGD + Momentum",
                                        "Adafactor"
                                    ]}
                                />
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Database className="w-3 h-3" /> Batch Size
                                </label>
                                <input
                                    type="number"
                                    defaultValue={32}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-white/30 transition-all hover:bg-black/50"
                                />
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> Epochs
                                </label>
                                <input
                                    type="number"
                                    defaultValue={100}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-white/30 transition-all hover:bg-black/50"
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                            <button className="text-sm text-muted-foreground hover:text-white transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" /> Save Preset
                            </button>
                            <button
                                onClick={() => setIsTraining(!isTraining)}
                                style={{
                                    backgroundColor: themeColor,
                                    boxShadow: `0 0 30px ${themeColor}40`
                                }}
                                className="px-8 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                {isTraining ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                {isTraining ? "Training in Progress..." : "Start Training Run"}
                            </button>
                        </div>
                    </div>

                    {/* Metrics Graph Placeholder */}
                    <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm p-1 min-h-[300px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10 group-hover:scale-110 transition-transform duration-500">
                                    <Activity className="w-8 h-8 opacity-50" style={{ color: themeColor }} />
                                </div>
                                <p className="text-muted-foreground text-sm font-medium">Initialize training to view real-time loss curves</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Stats & Info */}
                <div className="lg:col-span-4 flex flex-col gap-8 h-full">

                    {/* System Status */}
                    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-xl flex-1 flex flex-col justify-center">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-2">
                            <Cpu className="w-4 h-4" /> System Resources
                        </h3>
                        <div className="space-y-6">
                            {[
                                { label: "GPU Usage", value: "84%", sub: "NVIDIA A100" },
                                { label: "VRAM", value: "12.4GB", sub: "of 24GB" },
                                { label: "CPU Load", value: "45%", sub: "12 Cores Active" }
                            ].map((stat, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-medium">{stat.label}</span>
                                        <div className="text-right">
                                            <span className="text-sm font-bold" style={{ color: themeColor }}>{stat.value}</span>
                                            <div className="text-[10px] text-muted-foreground">{stat.sub}</div>
                                        </div>
                                    </div>
                                    <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: stat.value }}
                                            transition={{ duration: 1, delay: i * 0.2 }}
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: themeColor }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dataset Card */}
                    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 relative overflow-hidden flex-1 flex flex-col justify-center">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                            <Database className="w-4 h-4" /> Active Dataset
                        </h3>

                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                                <span className="text-lg font-bold">CSV</span>
                            </div>
                            <div>
                                <div className="font-bold text-lg">training_data_v2.csv</div>
                                <div className="text-xs text-muted-foreground mt-1">Uploaded 2 hours ago</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                                <div className="text-xs text-muted-foreground">Samples</div>
                                <div className="text-lg font-bold">450k</div>
                            </div>
                            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                                <div className="text-xs text-muted-foreground">Size</div>
                                <div className="text-lg font-bold">1.2GB</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-medium text-green-400 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20 w-full justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            Validated & Ready
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
