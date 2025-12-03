"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import Plasma from "@/components/react-bits/Plasma"
import SuccessModal from "@/components/ui/success-modal"
import { ThemeToggle } from "@/components/theme-toggle"
import { Lock, Mail, User, ArrowRight, Loader2, AlertCircle, Github } from "lucide-react"
import { FaMicrosoft, FaApple, FaGoogle } from 'react-icons/fa'
import { auth, db, googleProvider, githubProvider, microsoftProvider, appleProvider } from "@/lib/firebase"
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, signInWithPopup, AuthProvider } from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"

export default function RegisterPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const router = useRouter()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [showSuccess, setShowSuccess] = useState(false)
    const [showErrorModal, setShowErrorModal] = useState(false)

    // Set default theme color to Cyan on mount
    useEffect(() => {
        setThemeColor("#00ffff")
    }, [setThemeColor])

    const handleSuccess = async (user: any) => {
        // Create user document
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || name,
                    photoURL: user.photoURL,
                    phoneNumber: user.phoneNumber,
                    createdAt: new Date().toISOString(),
                    role: "user"
                });
            }

            setShowSuccess(true)
            setTimeout(() => {
                router.push("/?login=success")
            }, 2000)
        } catch (e) {
            console.error("Error creating user doc:", e)
            router.push("/?login=success")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password)
            const user = userCredential.user

            await updateProfile(user, {
                displayName: name
            })

            await sendEmailVerification(user)
            await handleSuccess(user)

        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setShowErrorModal(true)
            } else {
                console.error("Registration error:", err)
                setError(err.message.replace("Firebase: ", ""))
            }
            setLoading(false)
        }
    }

    const handleSocialLogin = async (provider: AuthProvider) => {
        setLoading(true)
        setError("")
        try {
            const result = await signInWithPopup(auth, provider)
            await handleSuccess(result.user)
        } catch (err: any) {
            console.error("Social login error:", err)
            setError(err.message.replace("Firebase: ", ""))
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden text-white">
            <div className="absolute inset-0 z-0">
                <Plasma
                    key="plasma-register"
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
                            <h1 className="text-3xl font-black tracking-tight mb-2">Create Account</h1>
                            <p className="text-white/50 text-sm">Join us and start your journey</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-200 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-3.5 w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-black/40 transition-all"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>

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
                                        minLength={6}
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
                                        Create Account <ArrowRight className="w-4 h-4" />
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

                        <div className="grid grid-cols-4 gap-4">
                            <button
                                onClick={() => handleSocialLogin(googleProvider)}
                                className="group relative h-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with Google"
                            >
                                <div className="absolute inset-0 bg-red-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <FaGoogle className="w-6 h-6 text-red-500 relative z-10" />
                            </button>
                            <button
                                onClick={() => handleSocialLogin(githubProvider)}
                                className="group relative h-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with GitHub"
                            >
                                <div className="absolute inset-0 bg-white/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <Github className="w-6 h-6 text-white relative z-10" />
                            </button>
                            <button
                                onClick={() => handleSocialLogin(microsoftProvider)}
                                className="group relative h-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with Microsoft"
                            >
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <FaMicrosoft className="w-6 h-6 text-[#00a4ef] relative z-10" />
                            </button>
                            <button
                                onClick={() => handleSocialLogin(appleProvider)}
                                className="group relative h-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with Apple"
                            >
                                <div className="absolute inset-0 bg-white/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <FaApple className="w-6 h-6 text-white relative z-10" />
                            </button>
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-white/50 text-sm">
                                Already have an account?{" "}
                                <Link href="/auth/login" className="text-white font-bold hover:underline decoration-2 underline-offset-4" style={{ textDecorationColor: themeColor }}>
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div >
                </div >
            </motion.div >

            <SuccessModal
                isOpen={showSuccess}
                message="Successfully Signed Up"
                subMessage="Creating your account..."
            />

            <SuccessModal
                isOpen={showErrorModal}
                message="User Already Exists"
                subMessage="This email is already registered. Please sign in instead."
                type="error"
                onClose={() => setShowErrorModal(false)}
            />
        </div >
    )
}
