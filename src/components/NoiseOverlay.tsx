"use client"

import { useEffect, useState } from "react"

export function NoiseOverlay() {
    const [noiseData, setNoiseData] = useState("")

    useEffect(() => {
        const canvas = document.createElement("canvas")
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const imageData = ctx.createImageData(128, 128)
        const buffer32 = new Uint32Array(imageData.data.buffer)

        for (let i = 0; i < buffer32.length; i++) {
            if (Math.random() < 0.5) {
                buffer32[i] = 0xff000000 // Black with full alpha (will be reduced by CSS opacity)
            }
        }

        ctx.putImageData(imageData, 0, 0)
        setNoiseData(canvas.toDataURL())
    }, [])

    if (!noiseData) return null

    return (
        <div
            className="fixed inset-0 pointer-events-none z-[2] mix-blend-overlay"
            style={{
                backgroundImage: `url(${noiseData})`,
                opacity: 0.03,
            }}
        />
    )
}
