"use client"

import * as React from "react"
import { Moon, Sun, Monitor, Palette, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { useThemeColor } from "@/context/theme-context"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const { themeColor, setThemeColor, silkConfig, setSilkConfig } = useThemeColor()
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Click outside to close
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const colors = [
    { name: "Monochrome", value: "#ffffff" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Rose", value: "#f43f5e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Neon Pink", value: "#ff00ff" },
    { name: "Neon Cyan", value: "#00ffff" },
    { name: "Lime", value: "#84cc16" },
    { name: "Orange", value: "#f97316" },
    { name: "Quantum", value: "#FF007F" },
    { name: "Luxury", value: "#D4AF37" },
    { name: "Neo Brutal", value: "#FF4D4D" },
    { name: "Tangerine", value: "#FF8C00" },
    { name: "Bold Tech", value: "#1E90FF" },
  ]

  const handleConfigChange = (key: keyof typeof silkConfig, value: number) => {
    setSilkConfig({ ...silkConfig, [key]: value })
  }

  return (
    <div className="fixed top-6 right-6 z-[100]" ref={menuRef}>
      <motion.div
        className="relative"
        initial={false}
        animate={isOpen ? "open" : "closed"}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg"
        >
          <Palette className="w-5 h-5" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
              className="absolute top-12 right-0 w-80 p-4 rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl origin-top-right max-h-[80vh] overflow-y-auto"
            >
              <div className="space-y-6">
                {/* Mode Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme Mode</label>
                  <div className="flex items-center justify-between p-1 rounded-full bg-white/5 border border-white/5">
                    {["light", "dark", "system"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setTheme(mode)
                          if (mode === 'light') {
                            setThemeColor('#ffffff')
                          } else if (mode === 'dark') {
                            setThemeColor('#D4AF37')
                          }
                        }}
                        className={cn(
                          "flex-1 py-1.5 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1",
                          theme === mode
                            ? "bg-white/10 text-white shadow-sm"
                            : "text-muted-foreground hover:text-white"
                        )}
                      >
                        {mode === "light" && <Sun className="w-3 h-3" />}
                        {mode === "dark" && <Moon className="w-3 h-3" />}
                        {mode === "system" && <Monitor className="w-3 h-3" />}
                        <span className="capitalize">{mode}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accent Color</label>
                  <div className="grid grid-cols-5 gap-2">
                    {colors.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setThemeColor(color.value)}
                        className="group relative w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 border border-white/10"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      >
                        {themeColor === color.value && (
                          <Check className={cn("w-4 h-4 drop-shadow-md", color.value === '#ffffff' || color.value === '#FDF5E6' ? "text-black" : "text-white")} />
                        )}
                        <span className="sr-only">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Silk Controls */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    Background Settings <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px]">Beta</span>
                  </label>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white">
                        <span>Speed</span>
                        <span>{silkConfig.speed}</span>
                      </div>
                      <input
                        type="range" min="0" max="10" step="0.1"
                        value={silkConfig.speed}
                        onChange={(e) => handleConfigChange('speed', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white">
                        <span>Scale</span>
                        <span>{silkConfig.scale}</span>
                      </div>
                      <input
                        type="range" min="0.1" max="5" step="0.1"
                        value={silkConfig.scale}
                        onChange={(e) => handleConfigChange('scale', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white">
                        <span>Noise</span>
                        <span>{silkConfig.noiseIntensity}</span>
                      </div>
                      <input
                        type="range" min="0" max="5" step="0.1"
                        value={silkConfig.noiseIntensity}
                        onChange={(e) => handleConfigChange('noiseIntensity', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white">
                        <span>Rotation</span>
                        <span>{silkConfig.rotation}</span>
                      </div>
                      <input
                        type="range" min="0" max="360" step="1"
                        value={silkConfig.rotation}
                        onChange={(e) => handleConfigChange('rotation', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
