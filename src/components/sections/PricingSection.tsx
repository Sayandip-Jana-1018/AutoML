"use client"

import { motion } from "framer-motion"
import { Star, Cpu, CreditCard, Check } from "lucide-react"
import Link from "next/link"
import { NavButton } from "@/components/NavButton"
import MagicReveal from "@/components/ui/MagicReveal"

interface PricingSectionProps {
    themeColor: string
}

export function PricingSection({ themeColor }: PricingSectionProps) {
    const plans = [
        {
            name: "BRONZE",
            price: "Free",
            icon: Star,
            color: "from-orange-400 to-red-500",
            features: ["GCP Compute Training", "2 vCPU • 4GB RAM", "1 Hour Max Training", "10MB Dataset Limit", "Gemini 1.5 Flash"],
            highlight: false
        },
        {
            name: "SILVER",
            price: "₹799",
            icon: Cpu,
            color: "from-gray-300 to-gray-500",
            features: ["Everything in Bronze", "4 vCPU • 16GB RAM", "4 Hours Training", "100MB Dataset Limit", "GPT-4o Mini", "Gemini 1.5 Pro"],
            highlight: true
        },
        {
            name: "GOLD",
            price: "₹2499",
            icon: CreditCard,
            color: "from-yellow-400 to-yellow-600",
            features: ["Everything in Silver", "8 vCPU • 64GB RAM", "🚀 RunPod GPU (RTX 4000 Ada)", "9 vCPU • 50GB RAM • 20GB VRAM", "24 Hours Training", "500MB Dataset Limit", "Claude 3.5 Opus", "GPT-4o (Full)"],
            highlight: false
        }
    ]

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20 mt-[20vh]">
            <div className="max-w-7xl w-full mx-auto">
                <MagicReveal
                    title="Simple Pricing"
                    titleClassName="text-5xl md:text-6xl lg:text-7xl font-black mb-4"
                    contentDelay={0.7}
                    particleCount={45}
                >
                    <p className="text-lg md:text-xl text-foreground/60 text-center mb-12">
                        Start free, scale as you grow
                    </p>

                    {/* Pricing Cards */}
                    <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {plans.map((plan, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
                                className={`relative p-8 rounded-2xl backdrop-blur-3xl border ${plan.highlight ? 'border-white/30 scale-105' : 'border-white/20'} hover:scale-105 transition-all group overflow-hidden`}
                                style={{
                                    backgroundColor: `rgba(${parseInt(themeColor.slice(1, 3), 16)}, ${parseInt(themeColor.slice(3, 5), 16)}, ${parseInt(themeColor.slice(5, 7), 16)}, ${plan.highlight ? 0.12 : 0.08})`,
                                    backgroundImage: `linear-gradient(135deg, rgba(${parseInt(themeColor.slice(1, 3), 16)}, ${parseInt(themeColor.slice(3, 5), 16)}, ${parseInt(themeColor.slice(5, 7), 16)}, ${plan.highlight ? 0.18 : 0.1}), rgba(10, 12, 18, 0.95))`,
                                    boxShadow: plan.highlight
                                        ? `0 8px 32px rgba(0,0,0,0.5), 0 0 50px ${themeColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                                        : `0 8px 32px rgba(0,0,0,0.5), 0 0 30px ${themeColor}15, inset 0 1px 0 rgba(255,255,255,0.08)`
                                }}
                            >
                                {/* Glass shine effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-60" />

                                {/* Glow on hover */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                    style={{ background: `radial-gradient(circle at center, ${themeColor}40, transparent 70%)` }}
                                />

                                <div className="relative z-10 text-center">
                                    {/* Icon */}
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                                        <plan.icon className="w-7 h-7 text-black" />
                                    </div>

                                    {/* Name & Price */}
                                    <h3 className="text-xl font-bold text-white tracking-widest mb-1">{plan.name}</h3>
                                    <div className="mb-6">
                                        <span className="text-4xl font-black text-white">{plan.price}</span>
                                        {plan.price !== "Free" && <span className="text-foreground/60 text-sm">/month</span>}
                                    </div>

                                    {/* Divider */}
                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

                                    {/* Features */}
                                    <ul className="space-y-3 mb-6 text-left">
                                        {plan.features.map((feat, j) => (
                                            <li key={j} className="flex items-center gap-2 text-sm text-foreground/80">
                                                <Check className={`w-4 h-4 ${i === 2 ? 'text-yellow-400' : i === 1 ? 'text-blue-400' : 'text-green-400'}`} />
                                                {feat}
                                            </li>
                                        ))}
                                    </ul>

                                    {/* CTA Button */}
                                    <Link
                                        href="/pricing"
                                        className="block w-full px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 backdrop-blur-sm text-center"
                                        style={{
                                            backgroundColor: plan.highlight ? themeColor : `${themeColor}25`,
                                            border: `2px solid ${themeColor}`,
                                            color: plan.highlight ? 'white' : themeColor,
                                            boxShadow: plan.highlight ? `0 0 25px ${themeColor}50` : 'none'
                                        }}
                                    >
                                        {plan.price === "Free" ? "Start Free" : "Get Started"}
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-12 flex justify-center">
                        <NavButton href="/pricing" variant="ghost" size="lg" icon="arrow" className="backdrop-blur-md bg-white/5" requiresAuth>
                            View Full Pricing Details
                        </NavButton>
                    </div>
                </MagicReveal>
            </div>
        </section>
    )
}
