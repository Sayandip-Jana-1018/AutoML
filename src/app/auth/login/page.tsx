"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import Plasma from "@/components/react-bits/Plasma"
import { ThemeToggle } from "@/components/theme-toggle"
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Github, Phone, Smartphone } from "lucide-react"
import { FaMicrosoft, FaApple, FaGoogle } from 'react-icons/fa'
import { auth, googleProvider, githubProvider, microsoftProvider, appleProvider, db } from "@/lib/firebase"
import { signInWithEmailAndPassword, signInWithPopup, signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult, AuthProvider, fetchSignInMethodsForEmail, linkWithCredential, OAuthProvider } from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"

export default function LoginPage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const router = useRouter()

    // Login Mode: 'email' or 'phone'
    const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email')

    // Email State
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    // Phone State
    const [countryCode, setCountryCode] = useState("+91")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [otp, setOtp] = useState("")
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
    const [otpSent, setOtpSent] = useState(false)
    const [isOtpInvalid, setIsOtpInvalid] = useState(false)
    const [isPasswordInvalid, setIsPasswordInvalid] = useState(false)
    const [linkData, setLinkData] = useState<{ email: string, credential: any } | null>(null)

    const countryCodes = [
        { code: "+1", country: "USA/Canada" },
        { code: "+44", country: "UK" },
        { code: "+91", country: "India" },
        { code: "+61", country: "Australia" },
        { code: "+81", country: "Japan" },
        { code: "+49", country: "Germany" },
        { code: "+33", country: "France" },
        { code: "+86", country: "China" },
    ]

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

    // Set default theme color to Cyan on mount
    useEffect(() => {
        setThemeColor("#00ffff")
    }, [setThemeColor])

    // Initialize Recaptcha for Phone Auth
    useEffect(() => {
        if (!recaptchaVerifierRef.current && loginMode === 'phone') {
            try {
                recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': (response: any) => {
                        // reCAPTCHA solved, allow signInWithPhoneNumber.
                    }
                });
            } catch (e) {
                console.error("Recaptcha init error:", e)
            }
        }
    }, [loginMode])

    const handleSuccess = async (user: any) => {
        // Create user document if it doesn't exist
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    phoneNumber: user.phoneNumber,
                    createdAt: new Date().toISOString(),
                    role: "user"
                });
            }

            router.push("/?login=success")
        } catch (e) {
            console.error("Error creating user doc:", e)
            // Still redirect even if doc creation fails (it might already exist)
            router.push("/?login=success")
        }
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            await handleSuccess(userCredential.user)
        } catch (err: any) {
            // Don't log invalid credential errors as they're handled with the overlay
            if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/wrong-password') {
                console.error("Login error:", err)
            }

            // Show blur overlay for wrong password
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setIsPasswordInvalid(true)
            } else {
                setError(err.message.replace("Firebase: ", ""))
            }
            setLoading(false)
        }
    }

    const handlePhoneLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        if (!otpSent) {
            // Send OTP
            try {
                if (!recaptchaVerifierRef.current) return;
                const fullPhoneNumber = `${countryCode}${phoneNumber}`
                const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifierRef.current)
                setConfirmationResult(confirmation)
                setOtpSent(true)
                setLoading(false)
            } catch (err: any) {
                if (err.code !== 'auth/invalid-phone-number') {
                    console.error("Phone auth error:", err)
                }

                if (err.code === 'auth/invalid-app-credential') {
                    setError("Configuration Error: Add this domain to 'Authorized Domains' in Firebase Console.")
                } else if (err.code === 'auth/invalid-phone-number') {
                    setError("Invalid Phone Number format.")
                } else {
                    setError(err.message.replace("Firebase: ", ""))
                }

                setLoading(false)
                // Reset recaptcha
                if (recaptchaVerifierRef.current) {
                    recaptchaVerifierRef.current.clear()
                    recaptchaVerifierRef.current = null
                }
            }
        } else {
            // Verify OTP
            try {
                if (!confirmationResult) return;
                const result = await confirmationResult.confirm(otp)
                await handleSuccess(result.user)
            } catch (err: any) {
                console.error("OTP error:", err)
                if (err.code === 'auth/invalid-verification-code') {
                    setIsOtpInvalid(true)
                } else {
                    setError("Invalid OTP code")
                }
                setLoading(false)
            }
        }
    }

    const handleSocialLogin = async (provider: AuthProvider) => {
        setLoading(true)
        setError("")
        try {
            const result = await signInWithPopup(auth, provider)
            await handleSuccess(result.user)
        } catch (err: any) {
            // Don't log account-exists error as it's handled gracefully with the modal
            if (err.code !== 'auth/account-exists-with-different-credential') {
                console.error("Social login error:", err)
            }

            if (err.code === 'auth/account-exists-with-different-credential') {
                const email = err.customData?.email || err.email || "your email";
                const pendingCredential = OAuthProvider.credentialFromError(err);

                if (pendingCredential) {
                    // Show modal even if email is hidden by Email Enumeration Protection
                    // We only need the pendingCredential to perform the link
                    setLinkData({ email, credential: pendingCredential });
                } else {
                    setError("An account already exists with the same email address. Please sign in with your original provider to link accounts.")
                }
            } else if (err.code === 'auth/operation-not-allowed') {
                setError("This sign-in provider is disabled in the Firebase Console.")
            } else if (err.code === 'auth/popup-closed-by-user') {
                setError("Sign-in popup was closed.")
            } else {
                setError(err.message.replace("Firebase: ", ""))
            }
            setLoading(false)
        }
    }

    const handleLinkAccount = async () => {
        if (!linkData) return;
        setLoading(true);
        try {
            // We assume Google for now as it's the most common conflict with GitHub
            // In a full prod app, we might check fetchSignInMethodsForEmail again or ask user to pick provider
            const result = await signInWithPopup(auth, googleProvider);
            await linkWithCredential(result.user, linkData.credential);
            await handleSuccess(result.user);
        } catch (err: any) {
            console.error("Linking failed:", err);
            setError("Failed to link accounts: " + err.message);
            setLinkData(null);
        } finally {
            setLoading(false);
        }
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

                        {/* Login Mode Toggle */}
                        <div className="flex p-1 bg-black/30 rounded-xl mb-6 border border-white/10">
                            <button
                                onClick={() => setLoginMode('email')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${loginMode === 'email' ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                            >
                                Email
                            </button>
                            <button
                                onClick={() => setLoginMode('phone')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${loginMode === 'phone' ? 'bg-white/10 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
                            >
                                Phone
                            </button>
                        </div>

                        {loginMode === 'email' ? (
                            <form onSubmit={handleEmailLogin} className="space-y-4">
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
                        ) : (
                            <form onSubmit={handlePhoneLogin} className="space-y-4">
                                {!otpSent ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Phone Number</label>
                                        <div className="flex gap-2">
                                            <div className="relative w-24">
                                                <select
                                                    value={countryCode}
                                                    onChange={(e) => setCountryCode(e.target.value)}
                                                    className="w-full h-full bg-black/30 border border-white/10 rounded-xl px-2 text-white appearance-none outline-none focus:border-white/30 focus:bg-black/40 transition-all text-sm font-bold text-center"
                                                >
                                                    {countryCodes.map((c) => (
                                                        <option key={c.code} value={c.code} className="bg-black text-white">
                                                            {c.code}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="relative group flex-1">
                                                <Phone className="absolute left-4 top-3.5 w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                                                <input
                                                    type="tel"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-black/40 transition-all"
                                                    placeholder="9999999999"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div id="recaptcha-container"></div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-white/70 uppercase tracking-wider ml-1">Enter OTP</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-4 top-3.5 w-5 h-5 text-white/40 group-focus-within:text-white transition-colors" />
                                            <input
                                                type="text"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-white/20 outline-none focus:border-white/30 focus:bg-black/40 transition-all"
                                                placeholder="123456"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

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
                                            {otpSent ? "Verify OTP" : "Send OTP"} <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-transparent px-2 text-white/40 font-bold backdrop-blur-xl">Or continue with</span>
                            </div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => handleSocialLogin(googleProvider)}
                                className="group relative h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with Google"
                            >
                                <div className="absolute inset-0 bg-red-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <FaGoogle className="w-6 h-6 text-red-500 relative z-10" />
                            </button>
                            <button
                                onClick={() => handleSocialLogin(githubProvider)}
                                className="group relative h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with GitHub"
                            >
                                <div className="absolute inset-0 bg-white/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <Github className="w-6 h-6 text-white relative z-10" />
                            </button>
                            <button
                                onClick={() => handleSocialLogin(microsoftProvider)}
                                className="group relative h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                                title="Continue with Microsoft"
                            >
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                                <FaMicrosoft className="w-6 h-6 text-[#00a4ef] relative z-10" />
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

                {/* Invalid OTP Overlay */}
                {isOtpInvalid && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-3xl"
                    >
                        <div className="text-center p-6">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Invalid OTP</h3>
                            <p className="text-white/50 text-sm mb-6">The code you entered is incorrect. Please try again.</p>
                            <button
                                onClick={() => {
                                    setIsOtpInvalid(false)
                                    setOtp("")
                                }}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Invalid Password Overlay */}
                {isPasswordInvalid && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-3xl"
                    >
                        <div className="text-center p-6">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Wrong Password</h3>
                            <p className="text-white/50 text-sm mb-6">The email or password you entered is incorrect. Please try again.</p>
                            <button
                                onClick={() => {
                                    setIsPasswordInvalid(false)
                                    setPassword("")
                                }}
                                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Account Linking Modal */}
                {linkData && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-3xl p-4"
                    >
                        <div className="text-center p-6 bg-zinc-900/90 border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Account Exists</h3>
                            <p className="text-white/60 text-sm mb-6">
                                An account with <strong>{linkData.email === "your email" ? "this email" : linkData.email}</strong> already exists.
                                <br /><br />
                                To secure your account, please sign in with <strong>Google</strong> to verify it's you. We'll then link your GitHub account automatically.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleLinkAccount}
                                    className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <FaGoogle className="w-4 h-4" /> Verify with Google
                                </button>
                                <button
                                    onClick={() => setLinkData(null)}
                                    className="w-full py-3 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl font-bold transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    )
}
