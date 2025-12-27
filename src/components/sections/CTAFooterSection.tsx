"use client"

import { motion } from "framer-motion"
import { Github, Twitter, Linkedin, Mail, Heart, Sparkles, Instagram } from "lucide-react"
import { useThemeColor } from "@/context/theme-context"
import { NavButton } from "@/components/NavButton"
import { useState } from "react"
import Magnetic from "@/components/ui/Magnetic"
import MagicReveal from "@/components/ui/MagicReveal"

const footerLinks = {
    Product: [
        { name: "Studio", href: "/studio" },
        { name: "Marketplace", href: "/marketplace" },
        { name: "Pricing", href: "/pricing" },
        { name: "Deploy", href: "/deploy" },
    ],
    Resources: [
        { name: "Documentation", href: "/chat" },
        { name: "AI Chat", href: "/chat" },
        { name: "Visualize", href: "/visualize" },
        { name: "Profile", href: "/profile" },
    ],
    Company: [
        { name: "About", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Careers", href: "#" },
        { name: "Contact", href: "/chat" },
    ],
}

const socialLinks = [
    { name: "Email", icon: Mail, href: "mailto:sayandip.jana24@gmail.com", color: "#EA4335" },
    { name: "LinkedIn", icon: Linkedin, href: "https://www.linkedin.com/in/jsayandip2003/", color: "#0077B5" },
    { name: "GitHub", icon: Github, href: "https://github.com/Sayandip-Jana-1018", color: "#6e5494" },
    { name: "Twitter", icon: Twitter, href: "https://x.com/51Sayandip", color: "#1DA1F2" },
    { name: "Instagram", icon: Instagram, href: "https://www.instagram.com/sj_sayandip/", color: "#E4405F" },
]

export function CTAFooterSection() {
    const { themeColor } = useThemeColor()
    const [email, setEmail] = useState("")
    const [subscribed, setSubscribed] = useState(false)

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault()
        if (email) {
            setSubscribed(true)
            setEmail("")
            setTimeout(() => setSubscribed(false), 3000)
        }
    }

    return (
        <section className="relative z-50">
            {/* CTA Area - Glassmorphic with Animated Border */}
            <div className="relative px-6 md:px-12 lg:px-16 xl:px-20 py-20 overflow-hidden backdrop-blur-md bg-white/5 dark:bg-white/[0.02]">
                {/* Animated Top Border Line */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden"
                >
                    <div
                        className="h-full w-[200%] animate-[shimmer_3s_linear_infinite]"
                        style={{
                            background: `linear-gradient(90deg, transparent, ${themeColor}, transparent, ${themeColor}, transparent)`,
                        }}
                    />
                </div>

                {/* Background gradient */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{ background: `radial-gradient(ellipse at center top, ${themeColor}40, transparent 60%)` }}
                />

                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <MagicReveal
                        title="Ready to Build?"
                        titleClassName="text-4xl md:text-5xl lg:text-6xl font-black mb-4"
                        contentDelay={0.7}
                        particleCount={50}
                    >
                        <div className="flex justify-center mb-6">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`,
                                    boxShadow: `0 0 40px ${themeColor}30`
                                }}
                            >
                                <Sparkles className="w-8 h-8" style={{ color: themeColor }} />
                            </div>
                        </div>

                        <p className="text-foreground/60 text-lg mb-8 max-w-xl mx-auto">
                            Join thousands of ML engineers shipping production models faster with AutoForge ML.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <NavButton href="http://localhost:3001" variant="primary" size="lg" icon="arrow" requiresAuth>
                                Start Building Free
                            </NavButton>
                            <NavButton href="mailto:sayandip.jana24@gmail.com" variant="secondary" size="lg" external>
                                Talk to Us
                            </NavButton>
                        </div>
                    </MagicReveal>
                </div>

                {/* Footer content */}
                <div className="max-w-4xl mx-auto mt-16">
                    {/* Brand - Centered at top */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-8"
                    >
                        <h3 className="text-2xl font-black mb-1" style={{ color: themeColor }}>
                            AutoForge~ML
                        </h3>
                        <p className="text-white/40 text-xs">
                            Build. Train. Deploy. Zero Code.
                        </p>
                    </motion.div>

                    {/* 3 Equal Columns */}
                    <div className="grid grid-cols-3 gap-8 mb-8">
                        {Object.entries(footerLinks).map(([category, links], colIndex) => (
                            <motion.div
                                key={category}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: colIndex * 0.1 }}
                                className="text-center"
                            >
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-3">
                                    {category}
                                </h4>
                                <ul className="space-y-2">
                                    {links.map((link) => (
                                        <li key={link.name}>
                                            <a href={link.href} className="text-xs text-white/50 hover:text-white transition-colors">
                                                {link.name}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>

                    {/* Social Icons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="flex justify-center gap-4 mb-6"
                    >
                        {socialLinks.map((social) => (
                            <Magnetic key={social.name}>
                                <motion.a
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group"
                                    style={{
                                        background: `${social.color}20`,
                                        border: `1px solid ${social.color}40`
                                    }}
                                    whileHover={{
                                        scale: 1.15,
                                        boxShadow: `0 0 20px ${social.color}60`
                                    }}
                                    whileTap={{ scale: 0.95 }}
                                    aria-label={social.name}
                                >
                                    <social.icon className="w-5 h-5 transition-colors" style={{ color: social.color }} />
                                </motion.a>
                            </Magnetic>
                        ))}
                    </motion.div>

                    {/* Copyright */}
                    <div className="text-center pt-4 border-t border-white/5">
                        <p className="text-[10px] text-black flex items-center justify-center gap-1">
                            © {new Date().getFullYear()} AutoForge~ML • Built with
                            <Heart className="w-2.5 h-2.5" style={{ color: themeColor }} />
                            by Sayandip
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
