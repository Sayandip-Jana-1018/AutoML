"use client"

import { useEffect, useState } from "react"
import { useThemeColor } from "@/context/theme-context"

interface GradientOrbsProps {
    count?: number
    className?: string
}

export function GradientOrbs({ count = 3, className }: GradientOrbsProps) {
    const { themeColor } = useThemeColor()
    const [scrollY, setScrollY] = useState(0)

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY)
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Generate orb positions based on index
    const getOrbStyle = (index: number) => {
        const baseDelay = index * 2000
        const scrollOffset = scrollY * (0.05 + index * 0.02)

        const positions = [
            { left: '10%', top: '20%' },
            { right: '15%', top: '40%' },
            { left: '20%', bottom: '30%' },
            { right: '10%', bottom: '20%' },
        ]

        const sizes = [400, 300, 350, 280]
        const opacities = [0.15, 0.12, 0.1, 0.08]

        return {
            ...positions[index % positions.length],
            width: sizes[index % sizes.length],
            height: sizes[index % sizes.length],
            opacity: opacities[index % opacities.length],
            transform: `translateY(${scrollOffset}px)`,
            animationDelay: `${baseDelay}ms`
        }
    }

    return (
        <div className={`fixed inset-0 pointer-events-none overflow-hidden z-[1] ${className}`}>
            {Array.from({ length: count }).map((_, i) => {
                const style = getOrbStyle(i)
                return (
                    <div
                        key={i}
                        className="absolute rounded-full blur-3xl animate-pulse"
                        style={{
                            left: style.left,
                            right: style.right,
                            top: style.top,
                            bottom: style.bottom,
                            width: style.width,
                            height: style.height,
                            background: `radial-gradient(circle, ${themeColor}${i % 2 === 0 ? '40' : '30'}, transparent 70%)`,
                            opacity: style.opacity,
                            transform: style.transform,
                            animationDelay: style.animationDelay,
                            animationDuration: `${8 + i * 2}s`,
                            transition: 'transform 0.3s ease-out'
                        }}
                    />
                )
            })}
        </div>
    )
}
