"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useThemeColor } from "@/context/theme-context"
import { Check, X, Loader2, Star, Cpu, CreditCard } from "lucide-react"
import GradientBlinds from "@/components/PrismaticBurst"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import SuccessModal from "@/components/ui/success-modal"
import { RESOURCE_POLICIES } from "@/lib/resource-policy"

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function PricingPage() {
    const { user, userTier } = useAuth()
    const router = useRouter()
    const { themeColor, setThemeColor } = useThemeColor()
    const [loading, setLoading] = useState(false)
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly')
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [paymentId, setPaymentId] = useState("")
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)

    // Set default theme color to Purple on mount
    useEffect(() => {
        setThemeColor("#8B5CF6")
    }, [setThemeColor])

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script")
            script.src = "https://checkout.razorpay.com/v1/checkout.js"
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
        })
    }

    const handlePayment = async (plan: string, amount: number) => {
        if (!user) {
            router.push("/auth/login")
            return
        }

        setLoading(true)

        // For free plan (Bronze), switch directly without payment
        if (amount === 0) {
            try {
                const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
                const { db } = await import('@/lib/firebase')

                await setDoc(doc(db, 'users', user.uid), {
                    tier: 'free',
                    tierUpdatedAt: serverTimestamp(),
                    plan: 'BRONZE',
                    email: user.email
                }, { merge: true })

                console.log(`Tier updated to free for user ${user.uid}`)
                setPaymentId('FREE_PLAN_SWITCH')
                setShowSuccessModal(true)
            } catch (err) {
                console.error("Failed to switch to free plan:", err)
                alert("Failed to switch plan. Please try again.")
            } finally {
                setLoading(false)
            }
            return
        }

        const res = await loadRazorpay()

        if (!res) {
            alert("Razorpay SDK failed to load. Are you online?")
            setLoading(false)
            return
        }

        // Create Order
        const orderRes = await fetch("/api/payment/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        })

        if (!orderRes.ok) {
            alert("Server error. Are you online?")
            setLoading(false)
            return
        }

        const order = await orderRes.json()

        const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            name: "AutoForgeML Studio",
            description: `${plan} Membership`,
            order_id: order.id,
            handler: async function (response: any) {
                setIsPaymentOpen(false)
                setPaymentId(response.razorpay_payment_id)

                // Convert plan name to tier
                const tierMap: Record<string, 'free' | 'silver' | 'gold'> = {
                    'BRONZE': 'free',
                    'SILVER': 'silver',
                    'GOLD': 'gold'
                }
                const newTier = tierMap[plan] || 'free'

                // Save tier to Firestore
                if (user?.uid) {
                    try {
                        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
                        const { db } = await import('@/lib/firebase')

                        await setDoc(doc(db, 'users', user.uid), {
                            tier: newTier,
                            tierUpdatedAt: serverTimestamp(),
                            paymentId: response.razorpay_payment_id,
                            plan: plan,
                            email: user.email
                        }, { merge: true })

                        console.log(`Tier updated to ${newTier} for user ${user.uid}`)
                    } catch (err) {
                        console.error("Failed to update tier:", err)
                    }
                }

                setShowSuccessModal(true)
            },
            modal: {
                ondismiss: function () {
                    setIsPaymentOpen(false)
                },
                backdropclose: false,
                escape: true,
                animation: true
            },
            prefill: {
                name: user?.displayName,
                email: user?.email,
            },
            theme: {
                color: "#6366f1",
                backdrop_color: "rgba(0,0,0,0.95)"
            },
        }

        const paymentObject = new window.Razorpay(options)
        setIsPaymentOpen(true)
        paymentObject.open()
        setLoading(false)
    }

    // Fix for Razorpay Overlay Issue: Force dark background everywhere
    useEffect(() => {
        if (isPaymentOpen) {
            document.body.style.overflow = 'hidden'
            document.body.style.backgroundColor = '#020202'
            document.documentElement.style.backgroundColor = '#020202'
            // Force all razorpay containers to have dark backgrounds
            const interval = setInterval(() => {
                const razorpayFrames = document.querySelectorAll('.razorpay-container, .razorpay-backdrop, [class*="razorpay"]')
                razorpayFrames.forEach(el => {
                    (el as HTMLElement).style.backgroundColor = 'transparent'
                })
            }, 100)
            return () => clearInterval(interval)
        } else {
            document.body.style.overflow = 'auto'
        }
    }, [isPaymentOpen])

    /**
     * Pricing Calculation with 50% Profit Margin
     * 
     * Cost Basis (per month, assuming avg 10 training jobs):
     * - Free: e2-medium $0.07/hr × 1hr × 10 jobs = $7/month → ₹600 cost → ₹0 (subsidized)
     * - Silver: e2-standard-4 $0.13/hr × 2hr × 15 jobs = $3.9/month → ₹330 + AI APIs ₹200 = ₹530 cost → ₹800 (50% margin)
     * - Gold: e2-highmem-8 $0.36/hr × 4hr × 20 jobs = $28.8/month + RunPod $0.26/hr × 5 = $30 → ₹2500 + AI APIs ₹400 = ₹2900 → ₹4350 (50% margin)
     * 
     * Rounding to nice numbers for marketing
     */
    const MONTHLY_PRICES = {
        free: 0,
        silver: 799,    // Cost ~₹530, Price ₹799 = 50% margin
        gold: 2499      // Cost ~₹2900 (conservative), Price ₹4350 → ₹2499 for competitive pricing
    };

    const plans = [
        {
            name: "BRONZE",
            tier: "free" as const,
            price: MONTHLY_PRICES.free,
            icon: Star,
            color: "from-orange-400 to-red-500",
            features: [
                "GCP Compute Engine Training",
                `e2-medium (${RESOURCE_POLICIES.free.allowedMachineTypes[0]})`,
                "2 vCPU • 4 GB RAM",
                `Max ${RESOURCE_POLICIES.free.maxTrainingHours} Hour Training`,
                "10 MB Dataset Limit",
                `${RESOURCE_POLICIES.free.maxEpochs} Epochs Max`,
                "Gemini 1.5 Flash (Free)"
            ],
            missing: [
                "GPU Training",
                "Large Datasets (100MB+)",
                "Claude 3.5 Opus "
            ]
        },
        {
            name: "SILVER",
            tier: "silver" as const,
            price: billingCycle === 'monthly' ? MONTHLY_PRICES.silver : Math.round(MONTHLY_PRICES.silver * 0.8),
            icon: Cpu,
            color: "from-gray-300 to-gray-500",
            features: [
                "Everything in Bronze",
                `e2-standard-4 (4 vCPU • 16 GB RAM)`,
                `Max ${RESOURCE_POLICIES.silver.maxTrainingHours} Hours Training`,
                "100 MB Dataset Limit",
                `${RESOURCE_POLICIES.silver.maxEpochs} Epochs Max`,
                `${RESOURCE_POLICIES.silver.maxHpoTrials} HPO Trials`,
                "OpenAI GPT-4o Mini",
                "Gemini 1.5 Pro"
            ],
            missing: [
                "GPU Training (RunPod)",
                "500 MB Datasets",
                "Claude 3.5 Opus"
            ]
        },
        {
            name: "GOLD",
            tier: "gold" as const,
            price: billingCycle === 'monthly' ? MONTHLY_PRICES.gold : Math.round(MONTHLY_PRICES.gold * 0.8),
            icon: CreditCard,
            color: "from-yellow-400 to-yellow-600",
            features: [
                "Everything in Silver",
                `e2-highmem-8 (8 vCPU • 64 GB RAM)`,
                "🚀 RunPod GPU (RTX 4000 Ada)",
                "20 GB VRAM for Deep Learning",
                `Max ${RESOURCE_POLICIES.gold.maxTrainingHours} Hours Training`,
                "500 MB Dataset Limit",
                "Image/CNN Training Support",
                `${RESOURCE_POLICIES.gold.maxHpoTrials}+ HPO Trials`,
                "Claude 3.5 Opus (Best for Code)",
                "GPT-4o (Full)",
                "Priority Support"
            ],
            missing: []
        }
    ]

    // Force body AND html background to black on this page to prevent white bleed-through
    useEffect(() => {
        // Save original styles
        const originalBodyBg = document.body.style.backgroundColor
        const originalHtmlBg = document.documentElement.style.backgroundColor
        const originalOverflow = document.body.style.overflow

        // Apply dark theme styles to both html and body
        document.body.style.backgroundColor = "#020202"
        document.documentElement.style.backgroundColor = "#020202"

        // Add style to hide Razorpay's default white backdrop
        const style = document.createElement('style')
        style.id = 'razorpay-fix'
        style.innerHTML = `
            .razorpay-container {
                background: transparent !important;
            }
            .razorpay-backdrop {
                background: rgba(0, 0, 0, 0.8) !important;
                backdrop-filter: blur(8px) !important;
            }
            .razorpay-checkout-frame {
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8) !important;
            }
        `
        document.head.appendChild(style)

        return () => {
            // Restore original styles
            document.body.style.backgroundColor = originalBodyBg
            document.documentElement.style.backgroundColor = originalHtmlBg
            document.body.style.overflow = originalOverflow
            // Remove the style
            const styleEl = document.getElementById('razorpay-fix')
            if (styleEl) styleEl.remove()
        }
    }, [])

    return (
        <>
            <div className="fixed top-0 right-0 z-50">
                <ThemeToggle />
            </div>
            <div className="relative z-40">
                <Navbar />
            </div>

            {/* Custom Overlay for Razorpay - transparent to show blur underneath */}
            {isPaymentOpen && (
                <div className="fixed inset-0 z-[60] backdrop-blur-sm bg-black/50 transition-all duration-300" />
            )}

            <main className="min-h-screen bg-[#020202] pt-24 pb-12 px-4 flex flex-col items-center relative overflow-hidden">
                {/* Background */}
                <div className="absolute inset-0 z-0 opacity-40">
                    <GradientBlinds
                        gradientColors={['#000000', '#1a1a1a', themeColor]}
                        blindCount={20}
                        spotlightRadius={1.5}
                        spotlightOpacity={1.0}
                    />
                </div>

                <div className="relative z-10 text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-3">Pricing</h1>
                    <p className="text-white/60 text-sm md:text-base">Created to be with you throughout your entire journey.</p>

                    <div className="mt-6 inline-flex bg-white/5 rounded-full p-1 border border-white/10">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${billingCycle === 'monthly' ? 'bg-white/10 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingCycle('annually')}
                            className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${billingCycle === 'annually' ? 'bg-white/10 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            Annually <span className="text-[10px] text-green-400 ml-1">-20%</span>
                        </button>
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full px-4">
                    {plans.map((plan, i) => {
                        const isCurrentPlan = (plan.tier === 'free' && userTier === 'free') ||
                            (plan.tier === 'silver' && userTier === 'silver') ||
                            (plan.tier === 'gold' && userTier === 'gold');

                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className={`relative group bg-gradient-to-b ${i === 1 ? 'from-white/10 to-black/60 border-white/20' : 'from-white/5 to-black/60 border-white/10'} border rounded-[2rem] p-6 overflow-hidden hover:border-white/30 transition-all duration-300 flex flex-col`}
                                style={isCurrentPlan ? {
                                    outline: `2px solid ${themeColor}`,
                                    outlineOffset: '-2px',
                                    boxShadow: `0 0 30px ${themeColor}40`
                                } : {}}
                            >
                                {/* Current Plan Badge */}
                                {isCurrentPlan && (
                                    <div
                                        className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                        style={{ backgroundColor: `${themeColor}30`, color: themeColor }}
                                    >
                                        ✓ Current Plan
                                    </div>
                                )}

                                {/* Glow Effect */}
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b ${plan.color} opacity-10 blur-[60px] group-hover:opacity-20 transition-opacity`} />

                                <div className="relative z-10 flex flex-col h-full items-center text-center">
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}>
                                        <plan.icon className="w-6 h-6 text-black" />
                                    </div>

                                    <h3 className="text-lg font-bold text-white tracking-widest mb-1">{plan.name}</h3>
                                    <div className="text-[10px] text-white/50 uppercase tracking-widest mb-4">Membership</div>

                                    <div className="mb-6">
                                        <span className="text-4xl font-black text-white">₹{plan.price}</span>
                                        <span className="text-white/40 text-xs block mt-1">billed {billingCycle}</span>
                                    </div>

                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Plan Highlights</div>

                                    <div className="space-y-3 w-full text-left mb-6 flex-1">
                                        {plan.features.map((feat, j) => (
                                            <div key={j} className="flex items-center gap-2 text-xs text-white/80">
                                                <Check className={`w-3 h-3 ${i === 2 ? 'text-yellow-400' : i === 1 ? 'text-blue-400' : 'text-green-400'}`} />
                                                {feat}
                                            </div>
                                        ))}
                                        {plan.missing.map((feat, j) => (
                                            <div key={j} className="flex items-center gap-2 text-xs text-white/30">
                                                <X className="w-3 h-3 text-red-500/50" />
                                                {feat}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handlePayment(plan.name, plan.price)}
                                        disabled={loading || isCurrentPlan}
                                        className={`w-full py-3 rounded-xl font-bold text-xs transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${isCurrentPlan
                                            ? 'bg-white/5 border border-white/20 text-white/50 cursor-not-allowed'
                                            : plan.price === 0
                                                ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                                : i === 1
                                                    ? 'bg-white text-black hover:bg-gray-200'
                                                    : 'bg-gradient-to-r from-yellow-600 to-yellow-800 text-white hover:brightness-110'
                                            }`}
                                    >
                                        {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> :
                                            isCurrentPlan ? "Current Plan" :
                                                plan.price === 0 ? "Start for Free" : `Get ${plan.name}`}
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

            </main>

            <SuccessModal
                isOpen={showSuccessModal}
                message="Payment Successful!"
                subMessage={`Transaction ID: ${paymentId}`}
                onClose={() => setShowSuccessModal(false)}
            />
        </>
    )
}
