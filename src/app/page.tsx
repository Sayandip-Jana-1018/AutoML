"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import Silk from "@/components/react-bits/Silk"
import { useThemeColor } from "@/context/theme-context"
import { ThemeToggle } from "@/components/theme-toggle"
import TerminalDemo from "@/components/terminal-demo"
import { HeroSection } from "@/components/sections/HeroSection"
import { HowItWorksSection } from "@/components/sections/HowItWorksSection"
import { TechStackSection } from "@/components/sections/TechStackSection"
import { FeaturesSection } from "@/components/sections/FeaturesSection"
import { PricingSection } from "@/components/sections/PricingSection"
import { CTASection } from "@/components/sections/CTASection"
import { useAuth } from "@/context/auth-context"
import { Loader2 } from "lucide-react"

import AuthSuccessHandler from "@/components/auth-success-handler"

export default function Home() {
    const { themeColor, setThemeColor, silkConfig } = useThemeColor()
    const { user, loading } = useAuth()
    const router = useRouter()

    // Set default theme color to Gold on mount
    useEffect(() => {
        setThemeColor("#0cb322ff")
    }, [setThemeColor])

    // Protect Route
    useEffect(() => {
        if (!loading && !user) {
            router.push("/auth/login")
        }
    }, [user, loading, router])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) return null // Prevent flash of content before redirect

    return (
        <main className="relative bg-background selection:bg-primary/30 transition-colors duration-300">
            <AuthSuccessHandler />
            {/* Background */}
            <div className="fixed inset-0 z-0 h-full w-full dark:opacity-90 transition-opacity duration-500 pointer-events-none">
                <Silk
                    key={themeColor}
                    color={themeColor}
                    speed={silkConfig.speed}
                    scale={silkConfig.scale}
                    noiseIntensity={silkConfig.noiseIntensity}
                    rotation={silkConfig.rotation}
                />
            </div>
            <TerminalDemo />
            <Navbar />
            {/* Page Sections */}
            <HeroSection themeColor={themeColor} />
            <HowItWorksSection />
            <TechStackSection />
            <FeaturesSection />
            <PricingSection themeColor={themeColor} />
            <CTASection themeColor={themeColor} />
            <ThemeToggle />

            {/* Bottom Spacing */}
            <div className="h-20" />
        </main>
    )
}
