"use client"

import { motion } from "framer-motion"

interface PricingSectionProps {
    themeColor: string
}

export function PricingSection({ themeColor }: PricingSectionProps) {
    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20 mt-[20vh]">
            <div className="max-w-7xl w-full ml-auto">
                <div className="relative max-w-3xl ml-auto">
                    {/* Title - pushed to right */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-right mb-12 pr-8"
                    >
                        <h2 className="text-5xl md:text-6xl lg:text-7xl font-black mb-4 text-foreground">
                            Simple Pricing
                        </h2>
                        <p className="text-lg md:text-xl text-foreground/60">
                            Start free, scale as you grow
                        </p>
                    </motion.div>

                    {/* Container for cards and pricing */}
                    <div className="relative flex flex-col items-end gap-8">
                        {/* Glassmorphic pricing cards - TOP */}
                        <div className="relative z-10 grid md:grid-cols-2 gap-6 w-full max-w-2xl">
                            {[
                                { name: "Starter", price: "Free", features: ["5 Models/month", "Basic Support", "Community Access"], color: "#4CAF50" },
                                { name: "Pro", price: "$49", features: ["Unlimited Models", "Priority Support", "Advanced Analytics"], color: themeColor }
                            ].map((plan, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 40 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6, delay: 0.4 + i * 0.15 }}
                                    className="relative p-8 rounded-2xl backdrop-blur-xl border border-white/20 hover:scale-105 transition-all group overflow-hidden"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                                        boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 0 40px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.15)`
                                    }}
                                >
                                    {/* Glass shine effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-60" />

                                    {/* Glow on hover */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                                        style={{
                                            background: `radial-gradient(circle at center, ${plan.color}40, transparent 70%)`
                                        }}
                                    />

                                    <div className="relative z-10">
                                        <h3 className="text-2xl font-bold mb-2 text-foreground">{plan.name}</h3>
                                        <div className="flex items-baseline gap-1 mb-6">
                                            <span className="text-4xl font-black" style={{ color: plan.color }}>{plan.price}</span>
                                            {plan.price !== "Free" && <span className="text-foreground/60">/month</span>}
                                        </div>
                                        <ul className="space-y-3 mb-6">
                                            {plan.features.map((f, j) => (
                                                <li key={j} className="flex items-center gap-2 text-sm text-foreground/80">
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${plan.color}30`, border: `1px solid ${plan.color}50` }}>
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: plan.color }} />
                                                    </div>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            className="w-full px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 backdrop-blur-sm"
                                            style={{
                                                backgroundColor: `${plan.color}25`,
                                                border: `2px solid ${plan.color}`,
                                                color: plan.color,
                                                boxShadow: `0 0 25px ${plan.color}50`
                                            }}
                                        >
                                            Get Started
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Single glowing credit card - BOTTOM CENTER with 3D */}
                        <div className="relative z-0 flex justify-center w-full mt-8 max-w-2xl" style={{ perspective: '1200px' }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.8, type: "spring" }}
                                whileHover={{
                                    scale: 1.15,
                                    y: -30,
                                    rotateX: -8,
                                    transition: { duration: 0.5, ease: "easeOut" }
                                }}
                                className="relative"
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                {/* Ringlight glow effect */}
                                <div
                                    className="absolute inset-0 rounded-2xl blur-3xl opacity-80 animate-pulse"
                                    style={{
                                        background: `radial-gradient(ellipse at center, ${themeColor}80, ${themeColor}40, transparent 70%)`,
                                        transform: 'scale(1.4) translateZ(-20px)',
                                        transformStyle: 'preserve-3d'
                                    }}
                                />

                                {/* Secondary glow ring */}
                                <div
                                    className="absolute inset-0 rounded-2xl blur-2xl opacity-60"
                                    style={{
                                        background: `conic-gradient(from 0deg, ${themeColor}60, #FFD70060, ${themeColor}60)`,
                                        transform: 'scale(1.3) translateZ(-10px)',
                                        animation: 'spin 8s linear infinite',
                                        transformStyle: 'preserve-3d'
                                    }}
                                />

                                {/* Credit card image */}
                                <img
                                    src="/credit.png"
                                    alt="Credit card"
                                    className="relative w-[320px] h-auto rounded-2xl shadow-2xl"
                                    style={{
                                        filter: `brightness(1.2) saturate(1.3) drop-shadow(0 0 30px ${themeColor}90)`,
                                        boxShadow: `0 30px 80px ${themeColor}60, 0 15px 40px rgba(255, 215, 0, 0.4), inset 0 0 50px rgba(255,255,255,0.2)`,
                                        transformStyle: 'preserve-3d',
                                        transform: 'translateZ(0px)'
                                    }}
                                />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS for rotating glow */}
            <style jsx>{`
                @keyframes spin {
                    from {
                        transform: scale(1.3) translateZ(-10px) rotate(0deg);
                    }
                    to {
                        transform: scale(1.3) translateZ(-10px) rotate(360deg);
                    }
                }
            `}</style>
        </section>
    )
}
