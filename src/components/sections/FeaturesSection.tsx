"use client"

import { motion } from "framer-motion"
import { Code2, Shield, BarChart3, Users } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"

export function FeaturesSection() {
    const { themeColor } = useThemeColor()

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20">
            <div className="max-w-6xl w-full mr-auto">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="space-y-8"
                >
                    <div className="relative">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="space-y-4"
                        >
                            {/* Decorative line */}
                            <div className="flex items-center gap-4 mb-6">
                                <div
                                    className="h-1 w-16 rounded-full"
                                    style={{
                                        background: `linear-gradient(90deg, ${themeColor}, transparent)`
                                    }}
                                />
                                <span className="text-sm font-bold tracking-widest uppercase" style={{ color: themeColor }}>
                                    Premium
                                </span>
                            </div>

                            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
                                <span
                                    className="bg-clip-text text-transparent"
                                    style={{
                                        backgroundImage: `linear-gradient(135deg, ${themeColor}, #fff, ${themeColor})`
                                    }}
                                >
                                    Enterprise
                                </span>
                                <br />
                                <span className="text-foreground">Features</span>
                            </h2>

                            <p className="text-base md:text-lg text-foreground/70 max-w-xl font-medium">
                                Built for scale, designed for teams
                            </p>
                        </motion.div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-md">
                        {[
                            { title: "AI Code Generation", desc: "Production-ready code", icon: Code2, color: "#00D9FF" },
                            { title: "Enterprise Security", desc: "Bank-level encryption", icon: Shield, color: "#4CAF50" },
                            { title: "Real-time Analytics", desc: "Monitor performance", icon: BarChart3, color: "#FF6B9D" },
                            { title: "Team Collaboration", desc: "Work seamlessly", icon: Users, color: "#9C27B0" }
                        ].map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                                className="relative aspect-square p-4 rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 backdrop-blur-sm border border-foreground/20 hover:border-foreground/40 transition-all group overflow-hidden"
                                style={{
                                    boxShadow: `0 8px 32px ${themeColor}15, inset 0 0 20px rgba(255,255,255,0.05)`
                                }}
                            >
                                {/* Gradient overlay */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{
                                        background: `radial-gradient(circle at center, ${f.color}15, transparent 70%)`
                                    }}
                                />

                                <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                                        style={{
                                            backgroundColor: `${f.color}20`,
                                            boxShadow: `0 4px 20px ${f.color}30`
                                        }}
                                    >
                                        <f.icon className="w-6 h-6" style={{ color: f.color }} />
                                    </div>
                                    <h3 className="text-sm font-black mb-1 text-foreground">{f.title}</h3>
                                    <p className="text-[10px] text-foreground/60 leading-tight">{f.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
