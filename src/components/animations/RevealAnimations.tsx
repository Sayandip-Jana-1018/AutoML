"use client"

import { motion } from "framer-motion"
import { ReactNode } from "react"

interface RevealTextProps {
    children: ReactNode
    delay?: number
    className?: string
}

interface RevealSectionProps {
    children: ReactNode
    delay?: number
    className?: string
    direction?: "up" | "down" | "left" | "right"
}

// Staggered text reveal for headings
export function RevealText({ children, delay = 0, className = "" }: RevealTextProps) {
    return (
        <motion.span
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
                duration: 0.6,
                delay,
                ease: [0.25, 0.4, 0.25, 1]
            }}
            className={`inline-block ${className}`}
        >
            {children}
        </motion.span>
    )
}

// Blur-to-focus entrance animation for sections
export function RevealSection({
    children,
    delay = 0,
    className = "",
    direction = "up"
}: RevealSectionProps) {
    const directionOffset = {
        up: { y: 40, x: 0 },
        down: { y: -40, x: 0 },
        left: { y: 0, x: 40 },
        right: { y: 0, x: -40 }
    }

    return (
        <motion.div
            initial={{
                opacity: 0,
                ...directionOffset[direction],
                filter: "blur(8px)"
            }}
            whileInView={{
                opacity: 1,
                y: 0,
                x: 0,
                filter: "blur(0px)"
            }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
                duration: 0.7,
                delay,
                ease: [0.25, 0.4, 0.25, 1]
            }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// Mask reveal effect
export function MaskReveal({ children, delay = 0, className = "" }: RevealTextProps) {
    return (
        <div className={`relative overflow-hidden ${className}`}>
            <motion.div
                initial={{ y: "100%" }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{
                    duration: 0.6,
                    delay,
                    ease: [0.25, 0.4, 0.25, 1]
                }}
            >
                {children}
            </motion.div>
        </div>
    )
}

// Staggered children reveal
interface StaggerContainerProps {
    children: ReactNode
    staggerDelay?: number
    className?: string
}

export function StaggerContainer({ children, staggerDelay = 0.1, className = "" }: StaggerContainerProps) {
    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
                hidden: {},
                visible: {
                    transition: {
                        staggerChildren: staggerDelay
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
                visible: {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: {
                        duration: 0.5,
                        ease: [0.25, 0.4, 0.25, 1]
                    }
                }
            }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
