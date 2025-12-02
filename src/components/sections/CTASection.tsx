"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

interface CTASectionProps {
    themeColor: string
}

export function CTASection({ themeColor }: CTASectionProps) {
    return (
        <section className="relative z-20 min-h-screen flex items-center justify-center px-6 md:px-12 lg:px-16 xl:px-20">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="text-center max-w-3xl p-12 rounded-3xl bg-foreground/5 border border-foreground/10 backdrop-blur-sm"
            >
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 text-foreground">
                    Ready to Build?
                </h2>
                <p className="text-lg md:text-xl text-foreground/60 mb-10">
                    Join thousands of developers building with AI
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a href="/studio">
                        <button
                            className="px-12 py-5 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all hover:scale-110"
                            style={{ backgroundColor: themeColor, color: 'white' }}
                        >
                            <span className="flex items-center gap-3">
                                Get Started Free <ArrowRight className="w-6 h-6" />
                            </span>
                        </button>
                    </a>

                    <a href="https://sj-disease.vercel.app/" target="_blank" rel="noopener noreferrer">
                        <button
                            className="px-12 py-5 rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all hover:scale-110 border-2 bg-background/50 backdrop-blur-md"
                            style={{ borderColor: themeColor, color: themeColor }}
                        >
                            <span className="flex items-center gap-3">
                                Models
                            </span>
                        </button>
                    </a>
                </div>
            </motion.div>
        </section>
    )
}
