"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles, Zap, Code2, Rocket, Database, Cpu, Brain, Cloud, Terminal, LogOut } from "lucide-react"
import { NavButton } from "@/components/NavButton"
import MagicReveal from "@/components/ui/MagicReveal"
import { MagicCube } from "@/components/MagicCube"
import { TiltCard } from "@/components/ui/TiltCard"
import { useAuth } from "@/context/auth-context"
import Image from "next/image"

interface HeroSectionProps {
    themeColor: string
}

export function HeroSection({ themeColor }: HeroSectionProps) {
    const { user } = useAuth()

    return (
        <section className="relative z-20 min-h-screen flex items-center justify-center px-6 md:px-12 lg:px-16 xl:px-20 pt-32 pb-20">
            <MagicReveal
                title="AutoForge ~ ML"
                titleClassName="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 pb-4 overflow-visible"
                contentDelay={0.7}
                particleCount={60}
            >
                <div className="max-w-7xl w-full mx-auto">
                    {/* Subtitle */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.6 }}
                        className="text-center mb-12"
                    >
                        <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground/80">
                            Build Zero Code <span style={{ color: themeColor }}>AI Models</span>
                        </p>
                    </motion.div>

                    {/* Two Column Layout: Cards Left, Laptop Right */}
                    <div className="grid lg:grid-cols-2 gap-12 items-start">
                        {/* LEFT: Premium Glassy Feature Cards - 2x2 Grid + Buttons */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="space-y-6 pt-4"
                        >
                            {/* Cards with User Profile Layout */}
                            <div className="flex items-end gap-6">
                                {/* User Profile - Left Side Vertical */}
                                {user && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.6, delay: 0.9 }}
                                        className="flex flex-col items-center gap-2 self-stretch justify-end"
                                    >
                                        {/* Name - Vertical oriented (above photo) - Stretches to top of cards */}
                                        <div
                                            className="text-2xl mb-4 mr-1 font-bold flex-1 flex items-center"
                                            style={{
                                                color: themeColor,
                                                writingMode: 'vertical-rl',
                                                textOrientation: 'mixed',
                                                transform: 'rotate(180deg)',
                                                textShadow: `0 0 20px ${themeColor}50`,
                                                letterSpacing: '0.05em'
                                            }}
                                        >
                                            {user.displayName || user.email?.split('@')[0] || 'User'}
                                        </div>

                                        {/* Glowing Profile Photo (below text) */}
                                        <div className="relative">
                                            <motion.div
                                                className="absolute inset-0 rounded-full -z-10"
                                                style={{
                                                    background: `radial-gradient(circle, ${themeColor}80, ${themeColor}40)`,
                                                    filter: 'blur(10px)',
                                                }}
                                                animate={{
                                                    scale: [1, 1.2, 1],
                                                    opacity: [0.5, 0.8, 0.5]
                                                }}
                                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                            />
                                            <div
                                                className="w-12 h-12 rounded-full overflow-hidden border-2 relative"
                                                style={{ borderColor: themeColor, boxShadow: `0 0 15px ${themeColor}50` }}
                                            >
                                                {user.photoURL ? (
                                                    <Image
                                                        src={user.photoURL}
                                                        alt="Profile"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                                                        style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)` }}
                                                    >
                                                        {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                {/* 2x2 Grid - Premium Glassy Square Cards - Fixed sizes */}
                                <div className="grid grid-cols-2 gap-3" style={{ width: '340px' }}>
                                    {[
                                        { icon: Zap, title: "Instant Setup", desc: "Get started in seconds" },
                                        { icon: Code2, title: "Auto Code", desc: "AI-generated code" },
                                        { icon: Sparkles, title: "Smart Training", desc: "Optimized algorithms" },
                                        { icon: Rocket, title: "One-Click Deploy", desc: "Instant production" }
                                    ].map((feature, i) => (
                                        <TiltCard key={i} tiltAmount={8} scale={1.03}>
                                            <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.6, delay: 0.7 + i * 0.1 }}
                                                className="group relative p-4 rounded-2xl backdrop-blur-xl border border-white/20 hover:border-white/40 transition-all duration-500 text-center overflow-hidden h-[140px] flex flex-col justify-center"
                                                style={{
                                                    background: `linear-gradient(135deg, ${themeColor}15, ${themeColor}08)`,
                                                    boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${themeColor}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                                                }}
                                            >
                                                {/* Shimmer Effect */}
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                                    <div
                                                        className="absolute inset-0 opacity-20"
                                                        style={{ background: `radial-gradient(circle at 50% 50%, ${themeColor}40, transparent 70%)` }}
                                                    />
                                                </div>

                                                {/* Icon */}
                                                <div className="relative flex justify-center mb-2.5">
                                                    <div
                                                        className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                                            boxShadow: `0 8px 24px ${themeColor}50, inset 0 1px 0 rgba(255,255,255,0.2)`
                                                        }}
                                                    >
                                                        <feature.icon className="w-6 h-6" style={{ color: themeColor, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }} />
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <h3
                                                    className="text-sm font-bold mb-1 text-white group-hover:scale-105 transition-transform duration-300"
                                                    style={{ textShadow: `0 2px 10px ${themeColor}60` }}
                                                >
                                                    {feature.title}
                                                </h3>
                                                <p className="text-xs text-foreground/80 group-hover:text-white/90 leading-relaxed transition-colors duration-300">
                                                    {feature.desc}
                                                </p>

                                                {/* Bottom Glow */}
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                                    style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }}
                                                />
                                            </motion.div>
                                        </TiltCard>
                                    ))}
                                </div>
                            </div>

                            {/* CTA Buttons - Same width and height */}
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 1.1 }}
                                className="grid grid-cols-2 gap-3 pt-2 relative z-50"
                                style={{ width: '340px', marginLeft: user ? '64px' : '0' }}
                            >
                                <a
                                    href="/studio"
                                    onClick={(e) => {
                                        if (!user) {
                                            e.preventDefault()
                                            sessionStorage.setItem('redirectAfterLogin', '/studio')
                                            window.location.href = '/auth/login'
                                        }
                                    }}
                                    className="h-14 flex items-center justify-center gap-2 font-bold rounded-2xl text-white transition-all hover:scale-105"
                                    style={{
                                        background: themeColor,
                                        boxShadow: `0 4px 20px ${themeColor}40`
                                    }}
                                >
                                    Start Building
                                    <ArrowRight className="w-5 h-5" />
                                </a>
                                <a
                                    href="/profile"
                                    onClick={(e) => {
                                        if (!user) {
                                            e.preventDefault()
                                            sessionStorage.setItem('redirectAfterLogin', '/profile')
                                            window.location.href = '/auth/login'
                                        }
                                    }}
                                    className="h-14 flex items-center justify-center font-bold rounded-2xl transition-all hover:scale-105"
                                    style={{
                                        background: `${themeColor}15`,
                                        color: themeColor,
                                        border: `1px solid ${themeColor}30`
                                    }}
                                >
                                    View Profile
                                </a>
                            </motion.div>

                            {/* Auth Button - Logout when logged in, Sign In when not */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 1.3 }}
                                className="flex justify-center pt-3 relative z-50"
                                style={{ marginLeft: user ? '64px' : '0' }}
                            >
                                {user ? (
                                    <button
                                        onClick={() => {
                                            import('@/lib/firebase').then(({ auth }) => {
                                                auth.signOut()
                                                window.location.href = '/'
                                            })
                                        }}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'rgba(255,255,255,0.7)'
                                        }}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                ) : (
                                    <a
                                        href="/auth/login"
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm backdrop-blur-xl border transition-all hover:scale-105 active:scale-95"
                                        style={{
                                            background: `${themeColor}10`,
                                            borderColor: `${themeColor}30`,
                                            color: themeColor
                                        }}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Sign In
                                    </a>
                                )}
                            </motion.div>
                        </motion.div>

                        {/* RIGHT: 3D Rotating Cube - Revealed when MacBook scrolls up */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.8 }}
                            className="relative h-[500px] lg:h-[600px] flex items-center justify-end z-10 pb-48 pr-0"
                        >
                            {/* Rotating Cube Container - Replaced with MagicCube */}
                            <div className="relative">
                                <MagicCube themeColor={themeColor} size={180} />

                                {/* Pulsating Glow Effect Under Cube */}
                                <motion.div
                                    className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-36 h-20 blur-3xl rounded-full"
                                    style={{ background: `radial-gradient(ellipse, ${themeColor}, transparent 60%)` }}
                                    animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.85, 1.15, 0.85] }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </MagicReveal>
        </section>
    )
}
