"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import Plasma from "@/components/react-bits/Plasma"
import { ThemeToggle } from "@/components/theme-toggle"
import { Mail, ArrowRight, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import { auth } from "@/lib/firebase"
import { sendPasswordResetEmail } from "firebase/auth"

export default function ForgotPasswordPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    // Set default theme color to Cyan on mount
    useEffect(() => {
        setThemeColor("#00ffff")
    }, [setThemeColor])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setSuccess(false)

        try {
            await sendPasswordResetEmail(auth, email)
            setSuccess(true)
        } catch (err: any) {
            console.error("Reset password error:", err)
            setError(err.message.replace("Firebase: ", ""))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden text-white">
            <div className="absolute inset-0 z-0">
                <Plasma
                    key="plasma-forgot"
                    color={themeColor}
                    speed={2}
                    direction="forward"
                    scale={1.5}
                    opacity={0.8}
                    mouseInteractive={false}
                />
            </div>

            <div className="fixed top-0 right-0 z-50">
                <ThemeToggle />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md p-6"
            >
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 backdrop-blur-2xl shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                    <div className="relative p-8">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-black tracking-tight mb-2">Reset Password</h1>
                            <p className="text-white/50 text-sm">Enter your email to receive instructions</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-200 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-200 text-sm">
                                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                Check your email for reset link!
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-black/40 transition-all"
                                        placeholder="name@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl font-bold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}80, ${themeColor}40)`,
                                    boxShadow: `0 4px 20px ${themeColor}30`
                                }}
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Send Reset Link <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-white/50 text-sm">
                                Remember your password?{" "}
                                <Link href="/auth/login" className="text-white font-bold hover:underline decoration-2 underline-offset-4" style={{ textDecorationColor: themeColor }}>
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
