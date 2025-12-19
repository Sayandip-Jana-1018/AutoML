"use client"

import { motion } from "framer-motion"
import { Star, Quote } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { useEffect, useState } from "react"
import MagicReveal from "@/components/ui/MagicReveal"

const testimonials = [
    { name: "Sarah Chen", role: "ML Engineer", company: "TechCorp", avatar: "SC", quote: "AutoForge ML cut our model deployment time from weeks to hours. The AI code generation is incredibly accurate.", rating: 5 },
    { name: "James Rodriguez", role: "Data Scientist", company: "DataFlow", avatar: "JR", quote: "Finally, a platform that understands what ML engineers actually need. The VS Code integration is seamless.", rating: 5 },
    { name: "Emily Watson", role: "CTO", company: "StartupAI", avatar: "EW", quote: "We went from prototype to production in a single day. The multi-cloud training options are game-changing.", rating: 5 },
    { name: "Michael Park", role: "Research Lead", company: "AILabs", avatar: "MP", quote: "The model registry and version control saved us countless hours of debugging. Highly recommended.", rating: 5 },
]

function HexagonPattern({ themeColor }: { themeColor: string }) {
    return (
        <div className="absolute inset-0 overflow-hidden opacity-15 pointer-events-none">
            <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                    <pattern id="hexagons" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
                        <path d="M28 0 L56 16.7 L56 50 L28 66.7 L0 50 L0 16.7 Z M28 100 L56 116.7 L56 150 L28 166.7 L0 150 L0 116.7 Z" fill="none" stroke={themeColor} strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hexagons)" />
            </svg>

            <motion.div
                className="absolute top-20 left-20 w-20 h-20"
                animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill={themeColor} opacity="0.1" stroke={themeColor} strokeWidth="1" />
                </svg>
            </motion.div>

            <motion.div
                className="absolute bottom-40 right-16 w-28 h-28"
                animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="none" stroke={themeColor} strokeWidth="1.5" opacity="0.3" />
                </svg>
            </motion.div>
        </div>
    )
}

export function TestimonialsSection() {
    const { themeColor } = useThemeColor()
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % testimonials.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    return (
        <section className="relative z-20 py-24 px-6 md:px-12 lg:px-16 xl:px-20 overflow-hidden">
            <HexagonPattern themeColor={themeColor} />

            <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(ellipse at center, ${themeColor}40, transparent 60%)` }} />

            <div className="max-w-6xl mx-auto relative">
                <MagicReveal
                    title="Loved by Engineers"
                    titleClassName="text-4xl md:text-5xl font-black mb-4"
                    contentDelay={0.7}
                    particleCount={70}
                >
                    <p className="text-foreground/60 max-w-xl mx-auto text-center mb-16">
                        Join thousands of ML professionals who've transformed their workflow
                    </p>

                    {/* Testimonials Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        {testimonials.map((testimonial, i) => (
                            <motion.div
                                key={testimonial.name}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                onClick={() => setActiveIndex(i)}
                                className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-500 group overflow-hidden backdrop-blur-xl ${i === activeIndex ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
                                style={{
                                    background: i === activeIndex
                                        ? `linear-gradient(135deg, ${themeColor}25, ${themeColor}10)`
                                        : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))',
                                    border: `1px solid ${i === activeIndex ? themeColor + '60' : 'rgba(255,255,255,0.15)'}`,
                                    boxShadow: i === activeIndex
                                        ? `0 8px 32px ${themeColor}30, inset 0 1px 0 rgba(255,255,255,0.2)`
                                        : '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
                                {i === activeIndex && (
                                    <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at top right, ${themeColor}40, transparent 60%)` }} />
                                )}

                                <Quote className="absolute top-4 right-4 w-8 h-8 opacity-10" style={{ color: i === activeIndex ? themeColor : 'white' }} />

                                <div className="relative z-10">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 relative overflow-hidden"
                                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)`, boxShadow: `0 4px 12px ${themeColor}40` }}
                                        >
                                            {testimonial.avatar}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground text-base">{testimonial.name}</h4>
                                            <p className="text-xs text-foreground/50">{testimonial.role} at {testimonial.company}</p>
                                        </div>
                                    </div>

                                    <p className="text-foreground/80 text-sm leading-relaxed mb-4 font-medium">
                                        "{testimonial.quote}"
                                    </p>

                                    <div className="flex gap-1">
                                        {Array.from({ length: testimonial.rating }).map((_, j) => (
                                            <Star key={j} className="w-4 h-4 fill-current" style={{ color: themeColor }} />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Dots indicator */}
                    <div className="flex justify-center gap-3">
                        {testimonials.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveIndex(i)}
                                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                    background: i === activeIndex ? themeColor : 'rgba(255,255,255,0.2)',
                                    transform: i === activeIndex ? 'scale(1.4)' : 'scale(1)',
                                    boxShadow: i === activeIndex ? `0 0 12px ${themeColor}` : 'none'
                                }}
                            />
                        ))}
                    </div>
                </MagicReveal>
            </div>
        </section>
    )
}
