"use client"

import Link from "next/link"
import { useThemeColor } from "@/context/theme-context"
import { ArrowRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import Magnetic from "@/components/ui/Magnetic"

interface NavButtonProps {
    href: string
    children: React.ReactNode
    variant?: "primary" | "secondary" | "ghost"
    size?: "sm" | "md" | "lg"
    icon?: "arrow" | "external" | "none"
    className?: string
    magnetic?: boolean
    external?: boolean
}

export function NavButton({
    href,
    children,
    variant = "primary",
    size = "md",
    icon = "arrow",
    className,
    magnetic = true,
    external = false
}: NavButtonProps) {
    const { themeColor } = useThemeColor()

    // Size classes
    const sizeClasses = {
        sm: "px-4 py-2 text-sm gap-1.5",
        md: "px-6 py-3 text-base gap-2",
        lg: "px-8 py-4 text-lg gap-2.5"
    }

    // Variant styles
    const getVariantStyles = () => {
        switch (variant) {
            case "primary":
                return {
                    background: themeColor,
                    color: '#fff',
                    boxShadow: `0 4px 20px ${themeColor}40, 0 0 0 1px ${themeColor}30`,
                }
            case "secondary":
                return {
                    background: 'transparent',
                    border: `2px solid ${themeColor}`,
                    color: themeColor,
                }
            case "ghost":
                return {
                    background: `${themeColor}15`,
                    color: themeColor,
                    border: `1px solid ${themeColor}30`,
                }
            default:
                return {}
        }
    }

    const IconComponent = icon === "arrow" ? ArrowRight : icon === "external" ? ExternalLink : null

    const content = (
        <>
            <span className="relative z-10">{children}</span>
            {IconComponent && (
                <IconComponent
                    className={cn(
                        "relative z-10 transition-transform duration-300 group-hover:translate-x-1",
                        size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5"
                    )}
                />
            )}

            {/* Hover glow overlay */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"
                style={{
                    background: `radial-gradient(circle at center, ${themeColor}30, transparent 70%)`
                }}
            />
        </>
    )

    const buttonClasses = cn(
        "relative group inline-flex items-center justify-center font-bold rounded-full overflow-hidden",
        "transition-all duration-300 ease-out",
        "hover:scale-105 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        sizeClasses[size],
        className
    )


    if (external) {
        const button = (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses}
                style={getVariantStyles()}
                aria-label={typeof children === 'string' ? children : undefined}
            >
                {content}
            </a>
        )
        return magnetic ? <Magnetic>{button}</Magnetic> : button
    }

    const button = (
        <Link
            href={href}
            className={buttonClasses}
            style={getVariantStyles()}
        >
            {content}
        </Link>
    )

    return magnetic ? <Magnetic>{button}</Magnetic> : button
}
