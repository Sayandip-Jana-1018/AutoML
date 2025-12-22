"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

interface MagicCubeProps {
    themeColor: string
    size?: number
}

export function MagicCube({ themeColor, size = 176 }: MagicCubeProps) {
    return (
        <div className="relative mx-auto" style={{ width: size, height: size, perspective: '600px' }}>
            <motion.div
                animate={{ rotateX: 360, rotateY: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="w-full h-full relative"
                style={{ transformStyle: 'preserve-3d' }}
            >
                {[
                    { transform: `translateZ(${size / 2}px)`, bg: `linear-gradient(135deg, ${themeColor}60, ${themeColor}30)` },
                    { transform: `rotateY(180deg) translateZ(${size / 2}px)`, bg: `linear-gradient(135deg, ${themeColor}50, ${themeColor}20)` },
                    { transform: `rotateY(90deg) translateZ(${size / 2}px)`, bg: `linear-gradient(135deg, ${themeColor}70, ${themeColor}40)` },
                    { transform: `rotateY(-90deg) translateZ(${size / 2}px)`, bg: `linear-gradient(135deg, ${themeColor}40, ${themeColor}15)` },
                    { transform: `rotateX(90deg) translateZ(${size / 2}px)`, bg: `linear-gradient(135deg, ${themeColor}55, ${themeColor}25)` },
                    { transform: `rotateX(-90deg) translateZ(${size / 2}px)`, bg: `linear-gradient(135deg, ${themeColor}45, ${themeColor}18)` },
                ].map((face, i) => (
                    <div
                        key={i}
                        className="absolute inset-0 rounded-2xl border-2 backdrop-blur-md flex items-center justify-center"
                        style={{
                            transform: face.transform,
                            background: face.bg,
                            borderColor: themeColor,
                            boxShadow: `0 0 50px ${themeColor}80, inset 0 0 25px ${themeColor}30`
                        }}
                    >
                        <Sparkles className="w-10 h-10" style={{ color: 'white', filter: 'drop-shadow(0 0 10px white)' }} />
                    </div>
                ))}
            </motion.div>
        </div>
    )
}
