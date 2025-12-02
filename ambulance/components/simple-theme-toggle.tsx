"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function SimpleThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-slate-200/20 shadow-xl flex items-center justify-center transition-all hover:scale-110 hover:bg-white/20 active:scale-95 group"
            aria-label="Toggle Theme"
        >
            <div className="relative w-6 h-6">
                <Sun className="absolute inset-0 w-full h-full text-amber-400 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute inset-0 w-full h-full text-blue-400 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </div>
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
