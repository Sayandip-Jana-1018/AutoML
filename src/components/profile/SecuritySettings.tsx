"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Lock, Shield, Key, Eye, EyeOff, Loader2 } from "lucide-react"
import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useThemeColor } from "@/context/theme-context"

interface SecuritySettingsProps {
    userEmail: string
}

export function SecuritySettings({ userEmail }: SecuritySettingsProps) {
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState("")
    const { themeColor } = useThemeColor()

    const handlePasswordReset = async () => {
        if (!userEmail) return

        setSending(true)
        setError("")

        try {
            await sendPasswordResetEmail(auth, userEmail)
            setSent(true)
            setTimeout(() => setSent(false), 5000)
        } catch (err: any) {
            setError(err.message || "Failed to send reset email")
        } finally {
            setSending(false)
        }
    }

    return (
        <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 max-w-2xl mx-auto"
        >
            <div className="flex flex-col items-center text-center gap-3 mb-8">
                <div className="p-4 rounded-2xl" style={{ backgroundColor: `${themeColor}20` }}>
                    <Shield className="w-8 h-8" style={{ color: themeColor }} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: themeColor }}>Security Settings</h2>
                    <p className="text-sm text-black/60 dark:text-white/50">Manage your account security</p>
                </div>
            </div>

            {/* Password Reset */}
            <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-xl">
                        <Key className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-black dark:text-white mb-1">Password</h3>
                        <p className="text-sm text-black/60 dark:text-white/50">
                            Reset your password via email. We'll send a secure link to your registered email.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {sent && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
                        ✓ Password reset email sent to {userEmail}
                    </div>
                )}

                <button
                    onClick={handlePasswordReset}
                    disabled={sending || sent}
                    className="px-6 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    {sent ? "Email Sent!" : "Send Reset Link"}
                </button>
            </div>

            {/* Security Info */}
            <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6">
                <h3 className="font-bold text-black dark:text-white mb-4">Account Security</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-black/70 dark:text-white/60">Email Verified</span>
                        <span className="text-sm font-bold text-green-400">✓ Verified</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-black/70 dark:text-white/60">Two-Factor Auth</span>
                        <span className="text-sm font-bold text-yellow-400">Not Enabled</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-black/70 dark:text-white/60">Last Sign In</span>
                        <span className="text-sm text-black/70 dark:text-white/60">Today</span>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
