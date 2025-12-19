"use client"

import { useEffect, useState, useRef } from "react"
import { useThemeColor } from "@/context/theme-context"

interface AnimatedCounterProps {
    value: string
    label: string
    duration?: number
    className?: string
}

export function AnimatedCounter({
    value,
    label,
    duration = 2000,
    className
}: AnimatedCounterProps) {
    const { themeColor } = useThemeColor()
    const [displayValue, setDisplayValue] = useState("0")
    const [hasAnimated, setHasAnimated] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    // Parse the target value
    const parseValue = (val: string): { num: number; prefix: string; suffix: string } => {
        const match = val.match(/^([^\d]*)([\d.]+)([^\d]*)$/)
        if (match) {
            return {
                prefix: match[1] || "",
                num: parseFloat(match[2]),
                suffix: match[3] || ""
            }
        }
        return { prefix: "", num: 0, suffix: val }
    }

    useEffect(() => {
        if (hasAnimated) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !hasAnimated) {
                        setHasAnimated(true)
                        animateValue()
                    }
                })
            },
            { threshold: 0.3 }
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => observer.disconnect()
    }, [hasAnimated])

    const animateValue = () => {
        const { prefix, num, suffix } = parseValue(value)
        const startTime = performance.now()
        const isDecimal = num % 1 !== 0

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            const current = num * eased

            if (isDecimal) {
                setDisplayValue(`${prefix}${current.toFixed(1)}${suffix}`)
            } else {
                setDisplayValue(`${prefix}${Math.floor(current)}${suffix}`)
            }

            if (progress < 1) {
                requestAnimationFrame(animate)
            } else {
                setDisplayValue(value) // Ensure final value is exact
            }
        }

        requestAnimationFrame(animate)
    }

    return (
        <div
            ref={ref}
            className={`text-center p-4 rounded-xl backdrop-blur-xl border border-foreground/10 dark:border-white/10 ${className}`}
            style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
            }}
        >
            <div
                className="text-2xl md:text-3xl font-black mb-1"
                style={{
                    color: themeColor,
                    textShadow: `0 0 20px ${themeColor}40`
                }}
            >
                {displayValue}
            </div>
            <div className="text-xs text-foreground/50 uppercase tracking-wider font-medium">
                {label}
            </div>
        </div>
    )
}
