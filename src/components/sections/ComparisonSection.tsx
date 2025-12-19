"use client"

import { motion } from "framer-motion"
import { Check, X, Sparkles } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import SpotlightCard from "@/components/ui/SpotlightCard"
import MagicReveal from "@/components/ui/MagicReveal"

const comparisonData = {
    features: [
        "Zero-Code ML Training",
        "Visual Model Builder",
        "One-Click Cloud Deployment",
        "Model Version Control",
        "Real-time Monitoring",
        "Auto-scaling",
        "Team Collaboration",
        "Custom Integrations"
    ],
    platforms: [
        { name: "AutoForge ML", highlight: true, features: [true, true, true, true, true, true, true, true] },
        { name: "Traditional ML", highlight: false, features: [false, false, false, true, true, false, true, true] },
        { name: "Other No-Code", highlight: false, features: [true, true, false, false, false, false, false, false] }
    ]
}

function AnimatedCheck({ delay, isIncluded, themeColor }: { delay: number; isIncluded: boolean; themeColor: string }) {
    return (
        <motion.div
            initial={{ scale: 0, rotate: -180 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.4, type: "spring", stiffness: 200 }}
            className="flex items-center justify-center"
        >
            {isIncluded ? (
                <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                        boxShadow: `0 2px 8px ${themeColor}50`
                    }}
                >
                    <Check className="w-4 h-4 text-white" />
                </div>
            ) : (
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
                    <X className="w-3 h-3 text-white/30" />
                </div>
            )}
        </motion.div>
    )
}

export function ComparisonSection() {
    const { themeColor } = useThemeColor()

    return (
        <section className="relative z-20 py-24 px-6 md:px-12 lg:px-16 xl:px-20 overflow-hidden">
            {/* Background glow */}
            <div
                className="absolute inset-0 opacity-20"
                style={{ background: `radial-gradient(ellipse at bottom, ${themeColor}30, transparent 70%)` }}
            />

            <div className="max-w-5xl mx-auto relative">
                <MagicReveal
                    title="Why AutoForge?"
                    titleClassName="text-4xl md:text-5xl font-black mb-4"
                    contentDelay={0.7}
                    particleCount={70}
                >
                    {/* Sparkles Icon */}
                    <div className="flex justify-center mb-4">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{
                                background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}05)`,
                                border: `1px solid ${themeColor}30`
                            }}
                        >
                            <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
                        </div>
                    </div>

                    <p className="text-foreground/60 max-w-xl mx-auto text-center mb-16">
                        See how we stack up against traditional ML workflows and other platforms
                    </p>

                    {/* Comparison Table */}
                    <SpotlightCard
                        className="backdrop-blur-xl rounded-3xl border-white/10"
                        spotlightColor={`${themeColor}80`}
                    >
                        {/* Table Header */}
                        <div className="grid grid-cols-4 gap-4 p-6 border-b border-white/10">
                            <div className="text-sm font-medium text-foreground/50">Features</div>
                            {comparisonData.platforms.map((platform) => (
                                <div
                                    key={platform.name}
                                    className={`text-center font-bold text-sm ${platform.highlight ? '' : 'text-foreground/60'}`}
                                    style={{ color: platform.highlight ? themeColor : undefined }}
                                >
                                    {platform.name}
                                    {platform.highlight && (
                                        <div className="text-[10px] font-normal mt-1 text-white/50 uppercase tracking-wider">
                                            Recommended
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-white/5">
                            {comparisonData.features.map((feature, featureIndex) => (
                                <motion.div
                                    key={feature}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: featureIndex * 0.05 }}
                                    className="grid grid-cols-4 gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="text-sm text-foreground/70 flex items-center">
                                        {feature}
                                    </div>
                                    {comparisonData.platforms.map((platform, platformIndex) => (
                                        <div key={platform.name} className="flex justify-center">
                                            <AnimatedCheck
                                                delay={featureIndex * 0.05 + platformIndex * 0.1}
                                                isIncluded={platform.features[featureIndex]}
                                                themeColor={themeColor}
                                            />
                                        </div>
                                    ))}
                                </motion.div>
                            ))}
                        </div>
                    </SpotlightCard>
                </MagicReveal>
            </div>
        </section>
    )
}
