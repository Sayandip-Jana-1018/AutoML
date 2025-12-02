"use client"

import { cn } from "@/lib/utils"
import { motion, useMotionTemplate, useMotionValue } from "framer-motion"
import { MouseEvent } from "react"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  spotlight?: boolean
}

export function GlassCard({ children, className, spotlight = true }: GlassCardProps) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  return (
    <div
      className={cn(
        "group relative border border-white/10 bg-gray-900/20 overflow-hidden rounded-xl",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      {/* Spotlight Effect */}
      {spotlight && (
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                650px circle at ${mouseX}px ${mouseY}px,
                rgba(255,255,255,0.1),
                transparent 80%
              )
            `,
          }}
        />
      )}
      
      {/* Colored Back Glow (Subtle) */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Content */}
      <div className="relative h-full">
        {children}
      </div>
    </div>
  )
}
