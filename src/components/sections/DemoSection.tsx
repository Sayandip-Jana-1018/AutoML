"use client"

import { useState, useRef } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Play, Pause, Volume2, VolumeX, Maximize, ArrowRight } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import MagicReveal from "@/components/ui/MagicReveal"
import { NavButton } from "@/components/NavButton"

export function DemoSection() {
    const { themeColor } = useThemeColor()
    const [isPlaying, setIsPlaying] = useState(true)
    const [isMuted, setIsMuted] = useState(true)
    const videoRef = useRef<HTMLVideoElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    })

    const y = useTransform(scrollYProgress, [0, 1], [100, -100])
    const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9])

    const togglePlay = () => {
        if (!videoRef.current) return
        if (isPlaying) {
            videoRef.current.pause()
        } else {
            videoRef.current.play()
        }
        setIsPlaying(!isPlaying)
    }

    return (
        <section className="py-32 px-6 md:px-12 lg:px-20 relative z-10 overflow-hidden backdrop-blur-md bg-white/5 dark:bg-white/[0.02]" ref={containerRef}>
            {/* Background Glow */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] opacity-20 pointer-events-none blur-[120px] z-0"
                style={{ background: `radial-gradient(circle, ${themeColor}, transparent 70%)` }}
            />

            <div className="max-w-6xl mx-auto text-center mb-16 relative z-10">
                <MagicReveal
                    title="See It In Action"
                    titleClassName="text-4xl md:text-5xl lg:text-6xl font-black mb-6"
                    contentDelay={0.7}
                    particleCount={70}
                >
                    <p className="text-xl text-white/60 max-w-2xl mx-auto">
                        Watch how AutoForge transforms hours of manual coding into seconds of automated productivity.
                    </p>
                </MagicReveal>
            </div>

            {/* Video Container */}
            <motion.div
                style={{ y, scale }}
                className="relative max-w-5xl mx-auto aspect-video rounded-3xl overflow-hidden shadow-2xl group border border-white/10 z-10"
            >
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-inner group">
                    <div className="absolute inset-0 bg-black/10 z-10" />

                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        loop
                        muted={isMuted}
                        autoPlay
                        playsInline
                    >
                        <source src="/videomac.mp4" type="video/mp4" />
                    </video>

                    {/* Overlay Controls */}
                    <div className="absolute inset-0 z-20 flex flex-col justify-between p-8 transition-opacity duration-300">
                        {/* Top Bar */}
                        <div className="flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono border border-white/10">
                                DEMO_MODE_SEQ_01
                            </div>
                            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <Maximize className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Center Play Button */}
                        {!isPlaying && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                <button
                                    onClick={togglePlay}
                                    className="w-24 h-24 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all hover:scale-110 active:scale-95 group/btn"
                                    style={{
                                        background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                        boxShadow: `0 0 30px ${themeColor}40`
                                    }}
                                >
                                    <Play className="w-10 h-10 ml-2 fill-white text-white group-hover/btn:scale-110 transition-transform" />
                                </button>
                            </div>
                        )}

                        {/* Bottom Controls */}
                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={togglePlay} className="hover:text-white text-white/80 transition-colors">
                                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                            </button>

                            <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full w-1/3" style={{ background: themeColor }} />
                            </div>

                            <button onClick={() => setIsMuted(!isMuted)} className="hover:text-white text-white/80 transition-colors">
                                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="mt-12 text-center relative z-10">
                <NavButton href="/deploy" variant="primary" size="lg" icon="arrow" requiresAuth>
                    See It In Action
                </NavButton>
            </div>
        </section>
    )
}
