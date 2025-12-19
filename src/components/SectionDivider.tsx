"use client"

import { useThemeColor } from "@/context/theme-context"

export function SectionDivider() {
    const { themeColor } = useThemeColor()

    return (
        <div className="relative h-24 w-full overflow-hidden pointer-events-none -mt-12 -mb-12 z-10">
            <div className="absolute inset-0 flex items-center justify-center">
                {/* Glass Line */}
                <div
                    className="w-full max-w-4xl h-[1px] relative"
                    style={{
                        background: `linear-gradient(90deg, transparent, ${themeColor}80, transparent)`
                    }}
                >
                    {/* Glow Effect */}
                    <div
                        className="absolute inset-0 blur-md"
                        style={{
                            background: themeColor,
                            opacity: 0.5
                        }}
                    />
                </div>
            </div>

            {/* Center Orb */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="w-2 h-2 rounded-full backdrop-blur-md border border-white/20"
                    style={{
                        background: `${themeColor}20`,
                        boxShadow: `0 0 20px ${themeColor}60`
                    }}
                />
            </div>
        </div>
    )
}
