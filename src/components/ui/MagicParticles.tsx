"use client"

import { useEffect, useRef, useCallback } from "react"

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    alpha: number
    life: number
    maxLife: number
    phase: "swirl" | "disperse"  // Phase of animation
    targetX: number
    targetY: number
    angle: number  // For swirl rotation
    sparkle: number
}

interface MagicParticlesProps {
    isActive: boolean
    color?: string
    particleCount?: number
    className?: string
}

export default function MagicParticles({
    isActive,
    color = "#00ff88",
    particleCount = 50,  // Reduced for performance
    className = ""
}: MagicParticlesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const particlesRef = useRef<Particle[]>([])
    const animationRef = useRef<number | undefined>(undefined)

    // Parse hex color to RGB for glow effects
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 255, b: 136 }
    }

    const createParticle = useCallback((canvas: HTMLCanvasElement, index: number, total: number): Particle => {
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        // All particles originate from the left side with vertical spread
        const startX = -30 - Math.random() * 80
        const startY = centerY + (Math.random() - 0.5) * canvas.height * 0.8

        // Initial velocity toward center-right with randomness
        const baseAngle = Math.atan2(centerY - startY, centerX - startX)
        const speed = 2 + Math.random() * 3

        // Stagger the particles with slight angle variation for tornado spread
        const spreadAngle = baseAngle + (Math.random() - 0.5) * 0.8

        return {
            x: startX,
            y: startY,
            vx: Math.cos(spreadAngle) * speed,
            vy: Math.sin(spreadAngle) * speed,
            size: 0.8 + Math.random() * 2,
            alpha: 0.6 + Math.random() * 0.4,
            life: 0,
            maxLife: 200 + Math.random() * 150,
            phase: "swirl",
            // Target can be anywhere across the full width
            targetX: centerX + (Math.random() - 0.3) * canvas.width * 0.6,
            targetY: centerY + (Math.random() - 0.5) * canvas.height * 0.5,
            angle: Math.random() * Math.PI * 2,
            sparkle: Math.random()
        }
    }, [])

    const animate = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const rgb = hexToRgb(color)
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        particlesRef.current = particlesRef.current.filter(p => {
            p.life++
            p.sparkle = Math.sin(p.life * 0.2) * 0.5 + 0.5

            const lifeRatio = p.life / p.maxLife

            // Phase 1: Swirl toward center (first 40% of life)
            if (lifeRatio < 0.4) {
                // Tornado swirl effect - rotate around path while moving toward center
                p.angle += 0.15
                const distToTarget = Math.sqrt((p.targetX - p.x) ** 2 + (p.targetY - p.y) ** 2)

                // Gradually accelerate toward center with swirl
                const pullStrength = 0.08
                const swirlRadius = Math.max(5, distToTarget * 0.3)

                // Add swirl motion perpendicular to direction
                const toTargetAngle = Math.atan2(p.targetY - p.y, p.targetX - p.x)
                p.vx += Math.cos(toTargetAngle) * pullStrength
                p.vy += Math.sin(toTargetAngle) * pullStrength

                // Add perpendicular swirl force (tornado rotation)
                p.vx += Math.cos(p.angle) * 0.3
                p.vy += Math.sin(p.angle) * 0.3

                // Damping
                p.vx *= 0.96
                p.vy *= 0.96

                // Phase 2: Disperse outward randomly (after 40% of life)
            } else {
                if (p.phase === "swirl") {
                    // Transition to disperse - bias toward right side
                    p.phase = "disperse"
                    // Angle biased toward right (-60 to +60 degrees from horizontal)
                    const disperseAngle = (Math.random() - 0.5) * Math.PI * 0.7
                    const disperseSpeed = 3 + Math.random() * 4
                    p.vx = Math.cos(disperseAngle) * disperseSpeed
                    p.vy = Math.sin(disperseAngle) * disperseSpeed
                }

                // Slow down gradually with slight random drift
                p.vx *= 0.98
                p.vy *= 0.98
                p.vx += (Math.random() - 0.5) * 0.1
                p.vy += (Math.random() - 0.5) * 0.1
            }

            // Update position
            p.x += p.vx
            p.y += p.vy

            // Calculate alpha with fade in/out
            const fadeIn = Math.min(p.life / 15, 1)
            const fadeOut = 1 - Math.pow(Math.max(0, lifeRatio - 0.6) / 0.4, 2)
            const currentAlpha = p.alpha * fadeIn * fadeOut

            // Draw outer glow (large, soft)
            ctx.save()
            ctx.globalAlpha = currentAlpha * 0.25
            const outerGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6)
            outerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`)
            outerGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`)
            outerGradient.addColorStop(1, "transparent")
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * 6, 0, Math.PI * 2)
            ctx.fillStyle = outerGradient
            ctx.fill()
            ctx.restore()

            // Draw inner glow
            ctx.save()
            ctx.globalAlpha = currentAlpha * 0.5
            const innerGradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
            innerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`)
            innerGradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`)
            innerGradient.addColorStop(1, "transparent")
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
            ctx.fillStyle = innerGradient
            ctx.fill()
            ctx.restore()

            // Draw sparkle core (white, twinkling)
            ctx.save()
            ctx.globalAlpha = currentAlpha * (0.7 + p.sparkle * 0.3)
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.size * (0.6 + p.sparkle * 0.3), 0, Math.PI * 2)
            ctx.fillStyle = "#ffffff"
            ctx.shadowColor = color
            ctx.shadowBlur = 8
            ctx.fill()
            ctx.restore()

            // Draw subtle trail/streak during swirl phase
            if (p.phase === "swirl" && currentAlpha > 0.2) {
                ctx.save()
                ctx.globalAlpha = currentAlpha * 0.3
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`
                ctx.lineWidth = p.size * 0.5
                ctx.lineCap = "round"
                ctx.beginPath()
                ctx.moveTo(p.x, p.y)
                ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3)
                ctx.stroke()
                ctx.restore()
            }

            return p.life < p.maxLife
        })

        if (particlesRef.current.length > 0 || isActive) {
            animationRef.current = requestAnimationFrame(animate)
        }
    }, [color, isActive])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Set canvas size with higher resolution
        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1
            canvas.width = canvas.offsetWidth * dpr
            canvas.height = canvas.offsetHeight * dpr
            const ctx = canvas.getContext("2d")
            if (ctx) ctx.scale(dpr, dpr)
        }
        resizeCanvas()
        window.addEventListener("resize", resizeCanvas)

        if (isActive) {
            // Spawn particles in rapid succession for tornado effect
            const waves = 4
            const particlesPerWave = Math.ceil(particleCount / waves)

            for (let wave = 0; wave < waves; wave++) {
                setTimeout(() => {
                    for (let i = 0; i < particlesPerWave; i++) {
                        setTimeout(() => {
                            if (canvasRef.current) {
                                particlesRef.current.push(createParticle(canvasRef.current, i, particlesPerWave))
                            }
                        }, i * 15)  // Faster spawn rate
                    }
                }, wave * 300)  // Wave timing
            }

            animationRef.current = requestAnimationFrame(animate)
        }

        return () => {
            window.removeEventListener("resize", resizeCanvas)
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [isActive, particleCount, createParticle, animate])

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 pointer-events-none z-10 ${className}`}
            style={{ width: "100%", height: "100%" }}
        />
    )
}
