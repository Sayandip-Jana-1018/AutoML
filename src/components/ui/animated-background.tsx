"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"

export default function AnimatedBackground() {
    const { themeColor } = useThemeColor()
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let animationFrameId: number
        let width = window.innerWidth
        let height = window.innerHeight

        const resize = () => {
            width = window.innerWidth
            height = window.innerHeight
            canvas.width = width
            canvas.height = height
        }

        window.addEventListener("resize", resize)
        resize()

        // Particles/Orbs
        const orbs = Array.from({ length: 7 }, (_, i) => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            radius: Math.random() * 400 + 300,
            color: themeColor,
            alpha: Math.random() * 0.4 + 0.2,
        }))

        const draw = () => {
            if (!ctx) return
            ctx.fillStyle = "#050505"
            ctx.fillRect(0, 0, width, height)

            orbs.forEach((orb) => {
                orb.x += orb.vx
                orb.y += orb.vy

                // Bounce off walls
                if (orb.x < -orb.radius) { orb.x = width + orb.radius; orb.vx *= -1 }
                if (orb.x > width + orb.radius) { orb.x = -orb.radius; orb.vx *= -1 }
                if (orb.y < -orb.radius) { orb.y = height + orb.radius; orb.vy *= -1 }
                if (orb.y > height + orb.radius) { orb.y = -orb.radius; orb.vy *= -1 }

                const gradient = ctx.createRadialGradient(
                    orb.x,
                    orb.y,
                    0,
                    orb.x,
                    orb.y,
                    orb.radius
                )

                // Convert hex themeColor to rgb for gradient
                const hex = themeColor.replace("#", "")
                const r = parseInt(hex.substring(0, 2), 16)
                const g = parseInt(hex.substring(2, 4), 16)
                const b = parseInt(hex.substring(4, 6), 16)

                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${orb.alpha})`)
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)

                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2)
                ctx.fill()
            })

            animationFrameId = requestAnimationFrame(draw)
        }

        draw()

        return () => {
            window.removeEventListener("resize", resize)
            cancelAnimationFrame(animationFrameId)
        }
    }, [themeColor])

    return (
        <div className="fixed inset-0 z-0 overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            <div className="absolute inset-0 backdrop-blur-[100px]" /> {/* Heavy blur for glassy effect */}
            <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none" /> {/* Subtle noise if needed */}
        </div>
    )
}
