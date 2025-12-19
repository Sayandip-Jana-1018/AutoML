"use client"

import { useState } from "react"
import confetti from "canvas-confetti"
import { useThemeColor } from "@/context/theme-context"
import { Rocket } from "lucide-react"
import { motion } from "framer-motion"

export function EasterEgg() {
    const { themeColor } = useThemeColor()
    const [isActive, setIsActive] = useState(false)

    const triggerConfetti = () => {
        if (isActive) return
        setIsActive(true)

        const duration = 5000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 45, spread: 360, ticks: 200, zIndex: 200 }

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

        const colors = [
            themeColor,
            "#FFD700", // Gold
            "#FF0044", // Red/Pink
            "#00FF99", // Green
            "#00CCFF", // Blue
            "#9D00FF", // Purple
            "#FFFFFF"  // White
        ]

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now()

            if (timeLeft <= 0) {
                clearInterval(interval)
                setIsActive(false)
                return
            }

            // Increased particle count for more burst
            const particleCount = 80 * (timeLeft / duration)

            // Two sources for better coverage
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors
            })
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors
            })
        }, 200) // Faster interval for smoother flow
    }

    return (
        <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={triggerConfetti}
            className="fixed bottom-8 right-8 z-[200] w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl group cursor-pointer"
            style={{
                background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}10)`,
                boxShadow: `0 8px 32px ${themeColor}40, 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 20px ${themeColor}20`
            }}
        >
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at center, ${themeColor}, transparent)` }} />

            <Rocket
                className={`w-6 h-6 text-white relative z-10 ${isActive ? 'animate-pulse' : ''}`}
                style={{
                    filter: `drop-shadow(0 0 5px ${themeColor})`
                }}
            />
        </motion.button>
    )
}
