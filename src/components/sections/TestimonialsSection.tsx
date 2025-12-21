"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { useEffect, useState } from "react"
import MagicReveal from "@/components/ui/MagicReveal"

const testimonials = [
    {
        name: "Sarah Chen",
        role: "ML Engineer",
        company: "TechCorp",
        avatar: "SC",
        quote: "AutoForge ML cut our model deployment time from weeks to hours. The AI code generation is incredibly accurate and the interface is a joy to use.",
        rating: 5
    },
    {
        name: "James Rodriguez",
        role: "Data Scientist",
        company: "DataFlow",
        avatar: "JR",
        quote: "Finally, a platform that understands what ML engineers actually need. The VS Code integration is seamless and the auto-training is magical.",
        rating: 5
    },
    {
        name: "Emily Watson",
        role: "CTO",
        company: "StartupAI",
        avatar: "EW",
        quote: "We went from prototype to production in a single day. The multi-cloud training options are game-changing for our infrastructure.",
        rating: 5
    },
    {
        name: "Michael Park",
        role: "Research Lead",
        company: "AILabs",
        avatar: "MP",
        quote: "The model registry and version control saved us countless hours of debugging. Best ML platform I've ever used.",
        rating: 5
    },
]

export function TestimonialsSection() {
    const { themeColor } = useThemeColor()
    const [activeIndex, setActiveIndex] = useState(0)
    const [direction, setDirection] = useState(0)

    // Auto-advance
    useEffect(() => {
        const interval = setInterval(() => {
            setDirection(1)
            setActiveIndex((prev) => (prev + 1) % testimonials.length)
        }, 6000)
        return () => clearInterval(interval)
    }, [])

    const goTo = (index: number) => {
        setDirection(index > activeIndex ? 1 : -1)
        setActiveIndex(index)
    }

    const goNext = () => {
        setDirection(1)
        setActiveIndex((prev) => (prev + 1) % testimonials.length)
    }

    const goPrev = () => {
        setDirection(-1)
        setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
    }

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
            transition: {
                type: "spring" as const,
                stiffness: 100,
                damping: 15
            }
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -300 : 300,
            opacity: 0,
            scale: 0.9,
            transition: {
                type: "spring" as const,
                stiffness: 200,
                damping: 25
            }
        })
    }

    const current = testimonials[activeIndex]

    return (
        <section className="relative z-20 py-24 px-6 md:px-12 lg:px-16 xl:px-20 overflow-hidden backdrop-blur-md bg-white/5 dark:bg-white/[0.02]">

            {/* Background gradient */}
            <div
                className="absolute inset-0 opacity-20"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${themeColor}30, transparent 60%)` }}
            />

            <div className="max-w-4xl mx-auto relative">
                <MagicReveal
                    title="Loved by Engineers"
                    titleClassName="text-4xl md:text-5xl font-black mb-4"
                    contentDelay={0.7}
                    particleCount={40}
                >
                    <p className="text-foreground/60 max-w-lg mx-auto text-center mb-16">
                        Join thousands of ML professionals who've transformed their workflow
                    </p>

                    {/* Main Testimonial Card */}
                    <div className="relative">
                        {/* Navigation Arrows */}
                        <button
                            onClick={goPrev}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 z-20 w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all"
                        >
                            <ChevronLeft className="w-5 h-5 text-white/70" />
                        </button>
                        <button
                            onClick={goNext}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 z-20 w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all"
                        >
                            <ChevronRight className="w-5 h-5 text-white/70" />
                        </button>

                        {/* Card Container */}
                        <div className="relative h-[280px] overflow-hidden">
                            <AnimatePresence initial={false} custom={direction} mode="wait">
                                <motion.div
                                    key={activeIndex}
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    className="absolute inset-0"
                                >
                                    <div
                                        className="h-full rounded-3xl p-8 md:p-12 relative overflow-hidden backdrop-blur-xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeColor}15, rgba(0,0,0,0.7), ${themeColor}10)`,
                                            border: `1px solid ${themeColor}20`,
                                            boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px ${themeColor}10`
                                        }}
                                    >
                                        {/* Subtle top highlight */}
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                        {/* Quote icon */}
                                        <Quote
                                            className="absolute top-6 right-8 w-12 h-12 opacity-5"
                                            style={{ color: themeColor }}
                                        />

                                        <div className="relative z-10 flex flex-col h-full">
                                            {/* Quote */}
                                            <p className="text-white/90 text-lg md:text-xl leading-relaxed flex-1 font-medium">
                                                "{current.quote}"
                                            </p>

                                            {/* Author Info */}
                                            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/5">
                                                {/* Avatar */}
                                                <div
                                                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                                                        boxShadow: `0 4px 20px ${themeColor}40`
                                                    }}
                                                >
                                                    {current.avatar}
                                                </div>

                                                {/* Name & Role */}
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-white text-base">{current.name}</h4>
                                                    <p className="text-sm text-white/50">{current.role} at {current.company}</p>
                                                </div>

                                                {/* Stars */}
                                                <div className="flex gap-1">
                                                    {Array.from({ length: current.rating }).map((_, j) => (
                                                        <Star
                                                            key={j}
                                                            className="w-4 h-4 fill-current"
                                                            style={{ color: themeColor }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Dots Navigation */}
                    <div className="flex justify-center gap-2 mt-8">
                        {testimonials.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className="relative h-2 rounded-full transition-all duration-500 overflow-hidden"
                                style={{
                                    width: i === activeIndex ? '32px' : '8px',
                                    background: i === activeIndex ? 'transparent' : 'rgba(255,255,255,0.15)',
                                }}
                            >
                                {i === activeIndex && (
                                    <motion.div
                                        className="absolute inset-0 rounded-full"
                                        style={{ background: themeColor }}
                                        layoutId="activeDot"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Small avatars preview */}
                    <div className="flex justify-center gap-2 mt-6">
                        {testimonials.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${i === activeIndex ? 'ring-2 scale-110' : 'opacity-40 hover:opacity-70'}`}
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}90, ${themeColor}50)`,
                                    boxShadow: i === activeIndex ? `0 0 0 2px ${themeColor}` : 'none'
                                }}
                            >
                                {t.avatar}
                            </button>
                        ))}
                    </div>
                </MagicReveal>
            </div>
        </section>
    )
}
