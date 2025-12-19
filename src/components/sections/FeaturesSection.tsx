"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Code2, Shield, BarChart3, Users, Cpu, Zap, GitBranch, MessageSquare } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { NavButton } from "@/components/NavButton"
import MagicReveal from "@/components/ui/MagicReveal"
import React, { useRef } from "react"

function TiltCard({ children, className, style }: { children: React.ReactNode, className?: string, style?: any }) {
    const ref = useRef<HTMLDivElement>(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 })
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 })

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["-7deg", "7deg"])
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-7deg", "7deg"])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const width = rect.width
        const height = rect.height
        const mouseXFromCenter = e.clientX - rect.left - width / 2
        const mouseYFromCenter = e.clientY - rect.top - height / 2
        x.set(mouseXFromCenter / width)
        y.set(mouseYFromCenter / height)
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <div style={{ perspective: "1000px" }} className={className}>
            <motion.div
                ref={ref}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                    ...style
                }}
                className="w-full h-full"
            >
                <div style={{ transform: "translateZ(20px)" }} className="h-full">
                    {children}
                </div>
            </motion.div>
        </div>
    )
}

export function FeaturesSection() {
    const { themeColor } = useThemeColor()

    const features = [
        { title: "AI Code Generation", desc: "Auto-generate training scripts with Gemini, GPT-4, or Claude. Production-ready Python code.", icon: Code2, color: "#00D9FF" },
        { title: "Multi-Cloud Training", desc: "Train on GCP Compute Engine (CPU) or RunPod (GPU). Scale from free tier to enterprise.", icon: Cpu, color: "#FF6B9D" },
        { title: "Real-time VS Code Sync", desc: "Edit in VS Code with live sync to MLForge Studio. Auto-save on Ctrl+S.", icon: Zap, color: "#FFD700" },
        { title: "Model Registry", desc: "Version control for ML models. Track lineage, compare metrics, deploy any version.", icon: GitBranch, color: "#9C27B0" },
        { title: "Team Collaboration", desc: "Share projects, invite collaborators, fork models from Marketplace.", icon: Users, color: "#4CAF50" },
        { title: "AI Chat Assistant", desc: "Get coding help, debug errors, and generate improvements with multi-model AI chat.", icon: MessageSquare, color: "#FF9800" }
    ]

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20">
            <div className="max-w-7xl w-full mx-auto">
                <MagicReveal
                    title="Enterprise Features"
                    titleClassName="text-5xl md:text-6xl lg:text-7xl font-black leading-tight"
                    titleAlign="left"
                    contentDelay={0.6}
                    particleCount={50}
                >
                    {/* Decorative line */}
                    <div className="flex items-center gap-4 mb-6">
                        <div
                            className="h-1 w-16 rounded-full"
                            style={{ background: `linear-gradient(90deg, ${themeColor}, transparent)` }}
                        />
                        <span className="text-sm font-bold tracking-widest uppercase" style={{ color: themeColor }}>
                            Premium
                        </span>
                    </div>

                    <p className="text-lg md:text-xl text-foreground/70 max-w-2xl font-medium leading-relaxed mb-10">
                        Everything you need to build, train, and deploy production ML models. From AutoML to GPU training, we've got you covered.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl">
                        {features.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                            >
                                <TiltCard
                                    className="relative rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 dark:from-black/60 dark:to-black/30 backdrop-blur-xl border border-foreground/20 dark:border-white/20 group overflow-hidden h-full"
                                    style={{ boxShadow: `0 8px 32px ${themeColor}15, inset 0 0 20px rgba(255,255,255,0.05)` }}
                                >
                                    <div className="p-5 h-full relative group">
                                        {/* Gradient overlay */}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            style={{ background: `radial-gradient(circle at center, ${f.color}15, transparent 70%)` }}
                                        />

                                        {/* Content */}
                                        <div className="relative z-10 h-full flex flex-col">
                                            <div
                                                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: `${f.color}20`, boxShadow: `0 4px 20px ${f.color}30` }}
                                            >
                                                <f.icon className="w-6 h-6" style={{ color: f.color }} />
                                            </div>
                                            <h3 className="text-base font-black mb-2 text-foreground">{f.title}</h3>
                                            <p className="text-sm text-foreground/60 leading-relaxed">{f.desc}</p>
                                        </div>
                                    </div>
                                </TiltCard>
                            </motion.div>
                        ))}
                    </div>
                </MagicReveal>
            </div>
        </section>
    )
}
