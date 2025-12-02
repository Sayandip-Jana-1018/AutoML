"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import Plasma from "@/components/react-bits/Plasma"
import { ThemeToggle } from "@/components/theme-toggle"
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Github } from "lucide-react"
import { FaMicrosoft } from 'react-icons/fa'
import { FcGoogle } from "react-icons/fc"
import { authenticate } from "./actions"

export default function LoginPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Set default theme color to Cyan on mount
    useEffect(() => {
        setThemeColor("#00ffff")
    }, [setThemeColor])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            // Primary path: use NextAuth helper (preferred)
            const res = await signIn("credentials", {
                redirect: false,
                email,
                password,
                callbackUrl: "/?login=success",
            })

            // NextAuth v5 may return undefined or an object. Handle both.
            // If res is falsy or signals an error, treat as failure.
            if (!res || (res as any).error) {
                setError((res as any)?.error || "Login failed")
                setLoading(false)
                return
            }

            // success path
            // Redirect to home with success param
            router.push("/?login=success")
            return
        } catch (err: any) {
            // signIn threw (e.g. "Failed to fetch") — fallback to manual fetch
            console.warn("[Auth] signIn threw, falling back to manual fetch:", err?.message ?? err)

            try {
                // fetch CSRF token first
                const csrfResp = await fetch("/api/auth/csrf")
                if (!csrfResp.ok) {
                    throw new Error("Failed to fetch CSRF token")
                }
                const csrfJson = await csrfResp.json()
                const csrfToken = csrfJson?.csrfToken

                // Prepare form body (urlencoded) and request json response
                const body = new URLSearchParams()
                body.set("csrfToken", csrfToken ?? "")
                body.set("email", email)
                body.set("password", password)
                body.set("callbackUrl", "/?login=success")
                // Request JSON response to avoid redirect handling
                body.set("json", "true")

                const callbackResp = await fetch("/api/auth/callback/credentials", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    },
                    body: body.toString(),
                })

                // NextAuth returns JSON when json=true
                const json = await callbackResp.json()

                if (!callbackResp.ok || json?.error) {
                    setError(json?.error || "Login failed")
                    setLoading(false)
                    return
                }

                // success
                router.push("/?login=success")
                return
            } catch (fallbackErr: any) {
                console.error("[Auth] Manual fallback sign-in failed:", fallbackErr)
                setError("Login failed (network error). Check console/network tab.")
                setLoading(false)
                return
            }
        }
    }

    const handleGoogleSignIn = async () => {
        await signIn("google", { callbackUrl: "/?login=success" })
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden text-white">
            <div className="absolute inset-0 z-0">
                <Plasma
                    key="plasma-login"
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
                            <h1 className="text-3xl font-black tracking-tight mb-2">Welcome Back</h1>
                            <p className="text-white/50 text-sm">Sign in to continue your journey</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-200 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
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

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-black/40 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Link
                                    href="/auth/forgot-password"
                                    className="text-xs text-white/50 hover:text-white transition-colors"
                                >
                                    Forgot password?
                                </Link>
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
                                        Sign In <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-transparent px-2 text-white/40 font-bold backdrop-blur-xl">Or continue with</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={handleGoogleSignIn}
                                className="group relative w-14 h-14 rounded-full bg-white hover:bg-gray-100 transition-all flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 border border-gray-200"
                                title="Continue with Google"
                            >
                                <FcGoogle className="w-7 h-7" />
                            </button>
                            <button
                                onClick={() => signIn("github", { callbackUrl: "/?login=success" })}
                                className="group relative w-14 h-14 rounded-full bg-[#24292e] hover:bg-[#2f363d] transition-all flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 border border-white/10"
                                title="Continue with GitHub"
                            >
                                <Github className="w-6 h-6 text-white" />
                            </button>
                            <button
                                onClick={() => signIn("azure-ad", { callbackUrl: "/?login=success" })}
                                className="group relative w-14 h-14 rounded-full bg-[#00a4ef] hover:bg-[#0078d4] transition-all flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 border border-white/10"
                                title="Continue with Microsoft"
                            >
                                <FaMicrosoft className="w-6 h-6 text-white" />
                            </button>
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-white/50 text-sm">
                                Don't have an account?{" "}
                                <Link href="/auth/register" className="text-white font-bold hover:underline decoration-2 underline-offset-4" style={{ textDecorationColor: themeColor }}>
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
