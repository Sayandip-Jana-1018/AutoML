"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles, Zap, Code2, Rocket } from "lucide-react"
import { NavButton } from "@/components/NavButton"
import TextReveal from "@/components/ui/TextReveal"

interface HeroSectionProps {
    themeColor: string
}

export function HeroSection({ themeColor }: HeroSectionProps) {
    return (
        <section className="relative z-20 min-h-screen flex items-center justify-center px-6 md:px-12 lg:px-16 xl:px-20 py-20">
            <div className="max-w-7xl w-full">
                {/* Centered Title & Subtitle */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1
                            className="text-6xl py-4 mt-4 md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] mb-6"
                            style={{
                                backgroundImage: `linear-gradient(135deg, ${themeColor === '#ffffff' ? '#fff' : themeColor}, ${themeColor === '#ffffff' ? '#999' : '#fff'})`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                textShadow: `0 0 80px ${themeColor}30`
                            }}
                        >
                            AutoForge ~ ML
                        </h1>
                    </motion.div>

                    <div className="flex justify-center mb-6">
                        <TextReveal
                            text="Build Zero Code AI Models"
                            className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground/80 justify-center gap-2"
                            delay={0.2}
                        />
                    </div>


                </div>

                {/* Two Column Layout: Cards Left, Laptop Right */}
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                    {/* LEFT: Premium Glassy Feature Cards - 2x2 Grid + Buttons */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="space-y-6 pt-16"
                    >
                        {/* 2x2 Grid - Premium Glassy Square Cards */}
                        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                            {[
                                {
                                    icon: Zap,
                                    title: "Instant Setup",
                                    desc: "Get started in seconds"
                                },
                                {
                                    icon: Code2,
                                    title: "Auto Code",
                                    desc: "AI-generated code"
                                },
                                {
                                    icon: Sparkles,
                                    title: "Smart Training",
                                    desc: "Optimized algorithms"
                                },
                                {
                                    icon: Rocket,
                                    title: "One-Click Deploy",
                                    desc: "Instant production"
                                }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                                    whileHover={{ scale: 1.05, y: -8 }}
                                    className="group relative p-4 rounded-2xl backdrop-blur-xl border border-white/20 hover:border-white/40 transition-all duration-500 text-center overflow-hidden"
                                    style={{
                                        background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)`,
                                        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${themeColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                                    }}
                                >
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                        <div
                                            className="absolute inset-0 opacity-20"
                                            style={{
                                                background: `radial-gradient(circle at 50% 50%, ${themeColor}40, transparent 70%)`
                                            }}
                                        />
                                    </div>

                                    {/* Icon */}
                                    <div className="relative flex justify-center mb-2.5">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500"
                                            style={{
                                                background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                                boxShadow: `0 8px 24px ${themeColor}50, inset 0 1px 0 rgba(255,255,255,0.2)`
                                            }}
                                        >
                                            <feature.icon className="w-6 h-6" style={{ color: themeColor, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <h3
                                        className="text-sm font-bold mb-1 text-white group-hover:scale-105 transition-transform duration-300"
                                        style={{ textShadow: `0 2px 10px ${themeColor}60` }}
                                    >
                                        {feature.title}
                                    </h3>
                                    <p className="text-xs text-foreground/80 group-hover:text-white/90 leading-relaxed transition-colors duration-300">
                                        {feature.desc}
                                    </p>

                                    {/* Bottom Glow */}
                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {/* CTA Buttons - NavButton with magnetic effect */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.7 }}
                            className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2"
                        >
                            <NavButton
                                href="/studio"
                                variant="primary"
                                size="lg"
                                icon="arrow"
                            >
                                Start Building
                            </NavButton>
                            <NavButton
                                href="/chat"
                                variant="ghost"
                                size="lg"
                                icon="none"
                            >
                                View Docs
                            </NavButton>
                        </motion.div>
                    </motion.div>

                    {/* RIGHT: Laptop Space */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="relative h-[600px] lg:h-[700px] flex items-end justify-center"
                    >
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
