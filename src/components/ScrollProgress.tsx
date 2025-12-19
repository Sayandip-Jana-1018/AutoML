"use client"

import { useEffect, useState, useRef } from "react"
import { useThemeColor } from "@/context/theme-context"
import { Rocket } from "lucide-react"
import { motion, useScroll, useSpring, useTransform, useMotionValueEvent } from "framer-motion"
import Magnetic from "@/components/ui/Magnetic"

const SECTIONS = [
    { name: "Hero", position: 0 },
    { name: "How It Works", position: 14 },
    { name: "Tech Stack", position: 28 },
    { name: "Features", position: 42 },
    { name: "Pricing", position: 56 },
    { name: "Visualize", position: 70 },
    { name: "Testimonials", position: 85 },
]

export function ScrollProgress() {
    const { themeColor } = useThemeColor()

    // 1. Get native scroll progress (0 to 1)
    const { scrollYProgress } = useScroll()

    // 2. Smooth it with a spring physics simulation
    // stiffness=50, damping=20, restDelta=0.001 creates a 'heavy' but smooth feel (buttery)
    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 50,
        damping: 20,
        restDelta: 0.001
    })

    // 3. Map 0-1 to 0-100% for CSS values
    const heightPercent = useTransform(smoothProgress, [0, 1], ["0%", "100%"])
    const topPercent = useTransform(smoothProgress, [0, 1], ["0%", "100%"])

    // Track direction for rotation
    const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down')

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        const previous = scrollYProgress.getPrevious() ?? 0
        if (latest > previous) {
            setScrollDirection("down")
        } else {
            setScrollDirection("up")
        }

        // Force down-headed at the very top (start)
        if (latest < 0.005) {
            setScrollDirection("down")
        }
    })

    return (
        <div className="fixed left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col justify-center py-4 pointer-events-none h-[40vh] hidden lg:flex">
            {/* Main container - Layout & Anchoring (No overflow clip) */}
            <div className="relative h-full w-[1.5px] rounded-full overflow-visible">

                {/* Visual Track Layer - CLIPPED to prevent shimmer bleed */}
                <div
                    className="absolute inset-0 w-full h-full rounded-full overflow-hidden"
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        boxShadow: '0 0 15px rgba(0,0,0,0.8)'
                    }}
                >
                    {/* Animated shimmer */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{
                            background: `linear-gradient(180deg, transparent 0%, ${themeColor}40 50%, transparent 100%)`,
                            animation: 'shimmer 3s ease-in-out infinite'
                        }}
                    />

                    {/* Progress bar with glow (Top to Bottom) - LINKED TO SPRING */}
                    <motion.div
                        className="w-full rounded-full absolute top-0 left-0"
                        style={{
                            height: heightPercent,
                            background: themeColor, // Solid color for high visibility
                            boxShadow: `0 0 20px ${themeColor}, 0 0 10px ${themeColor}`, // Intense glow
                        }}
                    />
                </div>

                {/* Terminator Dot at the bottom */}
                <div
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.6)', boxShadow: '0 0 8px rgba(255,255,255,0.4)' }}
                />

                {/* Animated Rocket at progress tip - LINKED TO SPRING */}
                <motion.div
                    className="absolute left-1/2 z-[50]"
                    style={{
                        top: topPercent,
                        x: "-50%",
                        y: "-50%",
                    }}
                >
                    <Magnetic>
                        <div className="relative flex items-center justify-center rocket-bob">
                            {/* Glow behind rocket */}
                            <div
                                className="absolute w-12 h-12 rounded-full blur-xl transition-colors duration-500"
                                style={{ background: themeColor, opacity: 0.6 }}
                            />
                            {/* Rocket container */}
                            <div
                                className="relative w-8 h-8 rounded-full flex items-center justify-center group transition-transform duration-500 shadow-2xl border border-white/20"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                                    boxShadow: `0 4px 15px ${themeColor}60, inset 0 2px 0 rgba(255,255,255,0.3)`,
                                    transform: scrollDirection === 'down' ? 'rotate(135deg)' : 'rotate(-45deg)'
                                }}
                            >
                                {/* Rocket Icon */}
                                <Rocket className="w-4 h-4 text-white drop-shadow-md" />

                                {/* Tooltip */}
                                <div
                                    className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-1 rounded text-[10px] border border-white/10 backdrop-blur-md"
                                    style={{ transform: scrollDirection === 'down' ? 'rotate(-135deg)' : 'rotate(45deg)' }}
                                >
                                    {/* Display raw percentage for now, or could bind to spring */}
                                    <PercentageLabel progress={smoothProgress} />
                                </div>
                            </div>
                        </div>
                    </Magnetic>
                </motion.div>

                {/* Section marker dots */}
                {
                    SECTIONS.map((section, i) => (
                        <SectionDot
                            key={section.name}
                            section={section}
                            themeColor={themeColor}
                        />
                    ))
                }
            </div >

            {/* CSS Animations */}
            < style jsx > {`
                @keyframes shimmer {
                    0%, 100% { opacity: 0.2; transform: translateY(-100%); }
                    50% { opacity: 0.5; transform: translateY(100%); }
                }
                .rocket-bob {
                    animation: rocketBob 2s ease-in-out infinite;
                }
                @keyframes rocketBob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
            `}</style >
        </div >
    )
}

function PercentageLabel({ progress }: { progress: any }) {
    const [value, setValue] = useState(0)
    useMotionValueEvent(progress, "change", (latest: number) => {
        setValue(Math.round(latest * 100))
    })
    return <>{value}%</>
}

// Logic for dots
function SectionDot({ section, themeColor }: { section: any, themeColor: string }) {
    return (
        <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 group pointer-events-auto cursor-pointer"
            style={{ top: `${section.position}%` }}
        >
            <div
                className="w-2.5 h-2.5 rounded-full transition-all duration-300 border border-white/40 bg-black/80 group-hover:scale-150"
                style={{
                    borderColor: 'rgba(255,255,255,0.4)',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    boxShadow: '0 0 5px rgba(0,0,0,0.5)'
                }}
            />
            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                <span className="text-[10px] font-medium px-2 py-1 rounded-md backdrop-blur-xl bg-black/80 text-white/60 border border-white/10">
                    {section.name}
                </span>
            </div>
        </div>
    )
}
