"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"

interface TiltCardProps {
    children: React.ReactNode
    className?: string
    tiltAmount?: number
    perspective?: number
    scale?: number
    style?: React.CSSProperties
}

export function TiltCard({
    children,
    className = "",
    tiltAmount = 10,
    perspective = 1000,
    scale = 1.02,
    style
}: TiltCardProps) {
    const ref = useRef<HTMLDivElement>(null)

    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // Spring animation for smooth movement
    const springConfig = { stiffness: 150, damping: 15 }
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltAmount, -tiltAmount]), springConfig)
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltAmount, tiltAmount]), springConfig)
    const scaleValue = useSpring(1, springConfig)

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return

        const rect = ref.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        // Normalize to -0.5 to 0.5
        x.set((e.clientX - centerX) / rect.width)
        y.set((e.clientY - centerY) / rect.height)
    }

    const handleMouseEnter = () => {
        scaleValue.set(scale)
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
        scaleValue.set(1)
    }

    return (
        <motion.div
            ref={ref}
            className={className}
            style={{
                perspective,
                transformStyle: "preserve-3d",
                ...style
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <motion.div
                style={{
                    rotateX,
                    rotateY,
                    scale: scaleValue,
                    transformStyle: "preserve-3d"
                }}
                className="w-full h-full"
            >
                {children}
            </motion.div>
        </motion.div>
    )
}
