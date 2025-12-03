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

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function PricingPage() {
    const { user } = useAuth()
    const router = useRouter()
    const { themeColor } = useThemeColor()
    const [loading, setLoading] = useState(false)
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly')
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [paymentId, setPaymentId] = useState("")
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)

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
            name: "Healthy AI",
            description: `${plan} Membership`,
            order_id: order.id,
            handler: async function (response: any) {
                setIsPaymentOpen(false)
                setPaymentId(response.razorpay_payment_id)
                setShowSuccessModal(true)
                // Verify payment on backend here
            },
            modal: {
                ondismiss: function () {
                    setIsPaymentOpen(false)
                }
            },
            prefill: {
                name: user?.displayName,
                email: user?.email,
            },
            theme: {
                color: "#6366f1",
                backdrop_color: "#000000"
            },
        }

        const paymentObject = new window.Razorpay(options)
        setIsPaymentOpen(true)
        paymentObject.open()
        setLoading(false)
    }

    const plans = [
        {
            name: "BRONZE",
            price: 0,
            icon: Star,
            color: "from-orange-400 to-red-500",
            features: [
                "Gemini Basic Access",
                "Claude 2.5 Support",
                "10 Summaries per day",
                "Basic Analytics"
            ],
            missing: [
                "Advanced AI Models",
                "GPT-3.5 Integration",
                "Grok 2 Capabilities"
            ]
        },
        {
            name: "SILVER",
            price: billingCycle === 'monthly' ? 999 : 799,
            icon: Cpu,
            color: "from-gray-300 to-gray-500",
            features: [
                "Gemini Basic Access",
                "Claude 2.5 Support",
                "Gemini 2.0 Advanced",
                "Claude 3.5 Haiku",
                "50 Summaries per day",
                "GPT-3.5 Integration",
                "Grok 2 Capabilities"
            ],
            missing: []
        },
        {
            name: "GOLD",
            price: billingCycle === 'monthly' ? 2999 : 2399,
            icon: CreditCard,
            color: "from-yellow-400 to-yellow-600",
            features: [
                "All Silver Features",
                "Claude 3.5 Opus",
                "Grok 3 Advanced",
                "Ultra-fast Processing",
                "Dedicated Support",
                "GPT-4 Turbo",
                "Gemini Ultra"
            ],
            missing: []
        }
    ]

    // Force body background to black on this page to prevent white bleed-through
    useEffect(() => {
        // Save original styles
        const originalBg = document.body.style.backgroundColor
        const originalOverflow = document.body.style.overflow

        // Apply dark theme styles
        document.body.style.backgroundColor = "#020202"

        return () => {
            // Restore original styles
            document.body.style.backgroundColor = originalBg
            document.body.style.overflow = originalOverflow
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

            {/* Custom Overlay for Razorpay */}
            {isPaymentOpen && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md transition-all duration-300" />
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
                    {plans.map((plan, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`relative group bg-gradient-to-b ${i === 1 ? 'from-white/10 to-black/60 border-white/20' : 'from-white/5 to-black/60 border-white/10'} border rounded-[2rem] p-6 overflow-hidden hover:border-white/30 transition-all duration-300 flex flex-col`}
                        >
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
                                    disabled={loading}
                                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${plan.price === 0
                                        ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                        : i === 1
                                            ? 'bg-white text-black hover:bg-gray-200'
                                            : 'bg-gradient-to-r from-yellow-600 to-yellow-800 text-white hover:brightness-110'
                                        }`}
                                >
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : plan.price === 0 ? "Start for Free" : `Get ${plan.name}`}
                                </button>
                            </div>
                        </motion.div>
                    ))}
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
