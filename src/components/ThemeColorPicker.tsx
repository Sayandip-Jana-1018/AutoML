"use client"

import { useThemeColor } from "@/context/theme-context"
import { motion } from "framer-motion"

const THEME_COLORS: { color: string; name: string }[] = [
    { color: "#0cb322", name: "Emerald" },
    { color: "#3B82F6", name: "Ocean" },
    { color: "#4c00ffff", name: "Violet" },
    { color: "#E947F5", name: "Magenta" },
    { color: "#F59E0B", name: "Amber" },
    { color: "#06B6D4", name: "Cyan" },
]

import { cn } from "@/lib/utils"

interface ThemeColorPickerProps {
    className?: string
    orientation?: "horizontal" | "vertical"
}

export function ThemeColorPicker({ className, orientation = "horizontal" }: ThemeColorPickerProps) {
    const { themeColor, setThemeColor } = useThemeColor()

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className={cn(
                "flex items-center gap-3 p-3 rounded-full backdrop-blur-md border border-white/10 bg-black/20",
                orientation === "vertical" ? "flex-col" : "flex-row",
                className
            )}
        >
            {THEME_COLORS.map((theme) => (
                <button
                    key={theme.color}
                    onClick={() => setThemeColor(theme.color)}
                    className="relative w-6 h-6 rounded-full transition-all duration-300 hover:scale-125 focus:outline-none group"
                    style={{
                        backgroundColor: theme.color,
                        boxShadow: themeColor === theme.color
                            ? `0 0 15px ${theme.color}, 0 0 30px ${theme.color}50`
                            : `0 2px 8px ${theme.color}40`
                    }}
                    title={theme.name}
                    aria-label={`Set theme color to ${theme.name}`}
                >
                    {/* Active indicator */}
                    {themeColor === theme.color && (
                        <motion.div
                            layoutId="activeTheme"
                            className="absolute inset-0 rounded-full border-2 border-white"
                            transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                        />
                    )}

                    {/* Tooltip */}
                    <span
                        className={cn(
                            "absolute text-[10px] font-medium text-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-white/10",
                            orientation === "vertical"
                                ? "right-full mr-3 top-1/2 -translate-y-1/2"
                                : "-bottom-8 left-1/2 -translate-x-1/2"
                        )}
                    >
                        {theme.name}
                    </span>
                </button>
            ))}
        </motion.div>
    )
}
