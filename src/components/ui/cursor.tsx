"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"

export function FluidCursor() {
  const { themeColor } = useThemeColor()
  const [isVisible, setIsVisible] = useState(false)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 25, stiffness: 700 }
  const cursorX = useSpring(mouseX, springConfig)
  const cursorY = useSpring(mouseY, springConfig)

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX - 16)
      mouseY.set(e.clientY - 16)
      if (!isVisible) setIsVisible(true)
    }

    const handleMouseDown = () => {
      const cursor = document.getElementById("fluid-cursor")
      if (cursor) cursor.style.transform = "scale(0.8)"
    }

    const handleMouseUp = () => {
      const cursor = document.getElementById("fluid-cursor")
      if (cursor) cursor.style.transform = "scale(1)"
    }

    window.addEventListener("mousemove", moveCursor)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", moveCursor)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [mouseX, mouseY, isVisible])

  if (!isVisible) return null

  return (
    <motion.div
      id="fluid-cursor"
      className="fixed top-0 left-0 w-6 h-6 rounded-full pointer-events-none z-[9999] backdrop-blur-sm border border-white/30 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
      style={{
        x: cursorX,
        y: cursorY,
      }}
    />
  )
}
