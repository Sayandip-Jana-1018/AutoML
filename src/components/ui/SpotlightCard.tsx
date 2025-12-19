"use client"

import { useMotionTemplate, useMotionValue, motion } from "framer-motion"
import { MouseEvent } from "react"

export default function SpotlightCard({
    children,
    className = "",
    spotlightColor = "rgba(255, 255, 255, 0.25)",
}: {
    children: React.ReactNode
    className?: string
    spotlightColor?: string
}) {
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect()
        mouseX.set(clientX - left)
        mouseY.set(clientY - top)
    }

    return (
        <div
            className={`group relative border border-white/10 bg-white/5 overflow-hidden rounded-xl ${className}`}
            onMouseMove={handleMouseMove}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
            radial-gradient(
              800px circle at ${mouseX}px ${mouseY}px,
              ${spotlightColor},
              transparent 100%
            )
          `,
                }}
            />
            <div className="relative h-full">{children}</div>
        </div>
    )
}
