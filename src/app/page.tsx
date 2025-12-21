"use client"

import { useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Navbar } from "@/components/navbar"
import Silk from "@/components/react-bits/Silk"
import { useThemeColor } from "@/context/theme-context"
import { ThemeToggle } from "@/components/theme-toggle"

import TerminalDemo from "@/components/terminal-demo"
import { ScrollProgress } from "@/components/ScrollProgress"

import { HeroSection } from "@/components/sections/HeroSection"
import { HowItWorksSection } from "@/components/sections/HowItWorksSection"
import { TechStackSection } from "@/components/sections/TechStackSection"
import { FeaturesSection } from "@/components/sections/FeaturesSection"
import { PricingSection } from "@/components/sections/PricingSection"
import { VisualizeSection } from "@/components/sections/VisualizeSection"
import { CTAFooterSection } from "@/components/sections/CTAFooterSection"
import { TestimonialsSection } from "@/components/sections/TestimonialsSection"
import { ComparisonSection } from "@/components/sections/ComparisonSection"
import { NoiseOverlay } from "@/components/NoiseOverlay"
import { SectionDivider } from "@/components/SectionDivider"
import { DemoSection } from "@/components/sections/DemoSection"
import { EasterEgg } from "@/components/EasterEgg"
import { SmoothScroll } from "@/components/SmoothScroll"
import { ThemeColorPicker } from "@/components/ThemeColorPicker"
import { useAuth } from "@/context/auth-context"
import { Loader2 } from "lucide-react"

import AuthSuccessHandler from "@/components/auth-success-handler"

export default function Home() {
    const { themeColor, setThemeColor, silkConfig } = useThemeColor()
    const { user } = useAuth()
    const router = useRouter()

    // Set default theme color to Gold on mount
    useEffect(() => {
        setThemeColor("#0cb322ff")
    }, [setThemeColor])

    // Homepage is now PUBLIC - no auth redirect

    return (
        <main className="relative bg-background selection:bg-primary/30 transition-colors duration-300">
            <AuthSuccessHandler />
            {/* Background */}
            <div className="fixed inset-0 z-0 h-full w-full dark:opacity-90 transition-opacity duration-500 pointer-events-none">
                <Silk
                    key={`${themeColor}-${silkConfig.speed}-${silkConfig.scale}-${silkConfig.noiseIntensity}-${silkConfig.rotation}`}
                    color={themeColor}
                    speed={silkConfig.speed}
                    scale={silkConfig.scale}
                    noiseIntensity={silkConfig.noiseIntensity}
                    rotation={silkConfig.rotation}
                />
            </div>

            <NoiseOverlay />
            <TerminalDemo />
            <Navbar />
            <ScrollProgress />
            {/* Hero Section with Parallax Container - MacBook scrolls first */}
            <div className="relative" style={{ height: '150vh' }}>
                <div className="sticky top-0 h-screen">
                    <HeroSection themeColor={themeColor} />
                </div>
            </div>
            <HowItWorksSection />
            <SectionDivider />
            <TechStackSection />
            <SectionDivider />
            <FeaturesSection />
            <PricingSection themeColor={themeColor} />
            <SectionDivider />
            <ComparisonSection />
            <VisualizeSection />
            <SectionDivider />
            <DemoSection />
            <SectionDivider />
            <TestimonialsSection />
            <SectionDivider />
            <CTAFooterSection />
            <ThemeToggle />
            <ThemeColorPicker
                orientation="vertical"
                className="fixed right-6 top-[35%] -translate-y-1/2 z-[100] hidden lg:flex"
            />
            <EasterEgg />
            <SmoothScroll />
        </main>
    )
}
