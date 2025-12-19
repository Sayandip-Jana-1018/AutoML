"use client"

import { motion } from "framer-motion"
import { Database, Cpu, Rocket, Users, RefreshCw } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { NavButton } from "@/components/NavButton"
import MagicReveal from "@/components/ui/MagicReveal"

export function HowItWorksSection() {
    const { themeColor } = useThemeColor()

    const steps = [
        { step: "01", title: "Upload Dataset", description: "Upload CSV, JSON, or Excel files. AI auto-detects columns, data types, and suggests target variables.", icon: Database },
        { step: "02", title: "Train with AI", description: "Choose ML algorithms (RandomForest, XGBoost, etc.) or let AutoML find the best model. Train on GCP or GPU.", icon: Cpu },
        { step: "03", title: "Deploy Instantly", description: "One-click deployment to production. Get REST API endpoints with automatic scaling and version control.", icon: Rocket },
        { step: "04", title: "Collaborate", description: "Share projects with teammates. Real-time VS Code sync, model marketplace, and version history.", icon: Users },
        { step: "05", title: "Iterate & Improve", description: "Use AI Chat to refine scripts, retrain models, and track metrics. Continuous improvement made easy.", icon: RefreshCw }
    ]

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20 mt-[120vh]">
            <div className="max-w-7xl w-full mx-auto">
                <MagicReveal
                    title="How It Works"
                    titleClassName="text-4xl md:text-5xl lg:text-6xl font-black mb-4 drop-shadow-2xl"
                    contentDelay={0.7}
                    particleCount={50}
                >
                    <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto drop-shadow-lg text-center mb-16">
                        Five simple steps from raw data to production-ready AI models
                    </p>

                    <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {steps.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                viewport={{ once: true }}
                                className="relative p-6 rounded-2xl backdrop-blur-2xl bg-black/60 border-2 border-white/30 hover:bg-black/70 hover:border-white/50 transition-all group shadow-2xl"
                                style={{ boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 40px ${themeColor}40, inset 0 1px 0 rgba(255,255,255,0.2)` }}
                            >
                                {/* Glow effect */}
                                <div
                                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl"
                                    style={{ background: `radial-gradient(circle at 50% 50%, ${themeColor}60, transparent 70%)` }}
                                />

                                <div className="flex flex-col items-center text-center space-y-3 relative z-10">
                                    <div
                                        className="w-16 h-16 rounded-full flex items-center justify-center mb-2 shadow-2xl"
                                        style={{ backgroundColor: `${themeColor}30`, boxShadow: `0 0 30px ${themeColor}60, 0 10px 30px rgba(0,0,0,0.5)` }}
                                    >
                                        <item.icon className="w-8 h-8" style={{ color: themeColor, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))' }} />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground drop-shadow-lg">{item.title}</h3>
                                    <p className="text-foreground/80 text-sm drop-shadow-md leading-relaxed">{item.description}</p>
                                    <div
                                        className="text-5xl font-black mt-2 drop-shadow-2xl"
                                        style={{ color: themeColor, textShadow: `0 0 20px ${themeColor}30` }}
                                    >
                                        {item.step}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="flex justify-center mt-12"
                    >
                        <NavButton href="/studio" variant="primary" size="lg" icon="arrow">
                            Try Demo
                        </NavButton>
                    </motion.div>
                </MagicReveal>
            </div>
        </section>
    )
}
