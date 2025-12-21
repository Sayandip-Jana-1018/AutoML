"use client"

import { motion, useInView, useAnimation } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import MagicParticles from "./MagicParticles"
import { useThemeColor } from "@/context/theme-context"

interface MagicRevealProps {
    title?: string
    titleClassName?: string
    titleAlign?: "left" | "center" | "right"
    children: React.ReactNode
    className?: string
    contentDelay?: number
    particleCount?: number
}

export default function MagicReveal({
    title,
    titleClassName = "text-4xl md:text-5xl lg:text-6xl font-black mb-8",
    titleAlign = "center",
    children,
    className = "",
    contentDelay = 0.8,
    particleCount = 45
}: MagicRevealProps) {
    const { themeColor } = useThemeColor()
    const containerRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(containerRef, {
        once: false,
        amount: 0.3,  // Trigger when 30% is visible - more responsive
        margin: "0px" // No margin for immediate detection
    })
    const controls = useAnimation()
    const [showParticles, setShowParticles] = useState(false)
    const [wasInView, setWasInView] = useState(false)

    useEffect(() => {
        if (isInView && !wasInView) {
            // Entering view - trigger reveal
            setShowParticles(true)
            setTimeout(() => setShowParticles(false), 3500)  // Longer particle duration
            controls.start("visible")
            setWasInView(true)
        } else if (!isInView && wasInView) {
            // Leaving view - trigger fade out immediately
            controls.start("hidden")
            setWasInView(false)
        }
    }, [isInView, controls, wasInView])

    // Title animation variants - slow slide up from bottom
    const titleVariants = {
        hidden: {
            opacity: 0,
            y: 80,
            scale: 0.95,
            filter: "blur(12px)",
            transition: {
                duration: 0.5,
                ease: "easeIn" as const
            }
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            transition: {
                duration: 1.2,
                ease: "easeOut" as const
            }
        }
    }

    // Content animation variants - slower slide up from bottom
    const contentVariants = {
        hidden: {
            opacity: 0,
            y: 100,
            scale: 0.98,
            filter: "blur(16px)",
            transition: {
                duration: 0.4,
                ease: "easeIn" as const
            }
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            transition: {
                duration: 1.4,
                delay: contentDelay,
                ease: "easeOut" as const
            }
        }
    }

    const alignmentClass = {
        left: "text-left",
        center: "text-center",
        right: "text-right"
    }[titleAlign]

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Magic Particles Layer */}
            <MagicParticles
                isActive={showParticles}
                color={themeColor}
                particleCount={particleCount}
            />

            {/* Title with gradient */}
            {title && (
                <motion.div
                    className={`relative z-20 ${alignmentClass}`}
                    variants={titleVariants}
                    initial="hidden"
                    animate={controls}
                >
                    <h2
                        className={`${titleClassName} animate-gradient-text`}
                        style={{
                            backgroundImage: `linear-gradient(135deg, ${themeColor}, #ffffff 40%, ${themeColor})`,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                            backgroundSize: "200% 200%"
                        }}
                    >
                        {title}
                    </h2>
                </motion.div>
            )}

            {/* Content with fade-in from bottom */}
            <motion.div
                variants={contentVariants}
                initial="hidden"
                animate={controls}
                className="relative z-20"
            >
                {children}
            </motion.div>
        </div>
    )
}
