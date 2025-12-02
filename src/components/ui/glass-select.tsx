"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Option {
    value: string
    label: string
}

interface GlassSelectProps {
    options: Option[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    themeColor: string
}

export function GlassSelect({ options, value, onChange, placeholder = "Select...", themeColor }: GlassSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300",
                    "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20",
                    "text-white outline-none focus:ring-2 focus:ring-white/20",
                    isOpen && "bg-white/10 border-white/30"
                )}
            >
                <span className={cn("text-sm font-medium", !value && "text-white/50")}>
                    {selectedLabel}
                </span>
                <ChevronDown
                    className={cn(
                        "w-4 h-4 text-white/50 transition-transform duration-300",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-50 w-full mt-2 overflow-hidden rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl bg-black/80"
                    >
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value)
                                        setIsOpen(false)
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                                        "hover:bg-white/10 text-left",
                                        value === option.value ? "text-white bg-white/5" : "text-white/70 hover:text-white"
                                    )}
                                >
                                    <span>{option.label}</span>
                                    {value === option.value && (
                                        <Check className="w-4 h-4" style={{ color: themeColor }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
