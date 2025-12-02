"use client"

import { motion } from "framer-motion"
import { Database, Cpu, Rocket } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"

export function HowItWorksSection() {
    const { themeColor } = useThemeColor()

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20 mt-[120vh]">
            <div className="max-w-6xl w-full mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 text-foreground drop-shadow-2xl">
                        How It Works
                    </h2>
                    <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto drop-shadow-lg">
                        Three simple steps to production-ready AI models
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { step: "01", title: "Upload Data", description: "Upload your dataset in any format", icon: Database },
                        { step: "02", title: "AI Processing", description: "AI analyzes and generates models", icon: Cpu },
                        { step: "03", title: "Deploy", description: "Deploy with a single click", icon: Rocket }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: i * 0.2 }}
                            viewport={{ once: true }}
                            className="relative p-8 rounded-2xl backdrop-blur-2xl bg-black/60 border-2 border-white/30 hover:bg-black/70 hover:border-white/50 transition-all group shadow-2xl"
                            style={{
                                boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${themeColor}40, inset 0 1px 0 rgba(255,255,255,0.2)`
                            }}
                        >
                            {/* Glow effect */}
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl"
                                style={{
                                    background: `radial-gradient(circle at 50% 50%, ${themeColor}60, transparent 70%)`
                                }}
                            />

                            <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                                <div
                                    className="w-20 h-20 rounded-full flex items-center justify-center mb-2 shadow-2xl"
                                    style={{
                                        backgroundColor: `${themeColor}30`,
                                        boxShadow: `0 0 30px ${themeColor}60, 0 10px 30px rgba(0,0,0,0.5)`
                                    }}
                                >
                                    <item.icon className="w-10 h-10" style={{ color: themeColor, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))' }} />
                                </div>
                                <h3 className="text-2xl font-bold text-white drop-shadow-lg">{item.title}</h3>
                                <p className="text-white/90 drop-shadow-md">{item.description}</p>
                                <div
                                    className="text-8xl font-black mt-4 drop-shadow-2xl"
                                    style={{
                                        color: `${themeColor}`,
                                        textShadow: `0 0 20px ${themeColor}30`
                                    }}
                                >
                                    {item.step}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
