"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, AlertTriangle } from "lucide-react"

interface SuccessModalProps {
    isOpen: boolean
    message: string
    subMessage?: string
    onClose?: () => void
    type?: 'success' | 'error'
}

export default function SuccessModal({ isOpen, message, subMessage, onClose, type = 'success' }: SuccessModalProps) {
    const isSuccess = type === 'success'
    const colorClass = isSuccess ? 'bg-green-500' : 'bg-red-500'
    const shadowClass = isSuccess ? 'shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'shadow-[0_0_20px_rgba(239,68,68,0.5)]'
    const borderClass = isSuccess ? 'border-green-500/50' : 'border-red-500/50'
    const bgLightClass = isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop Blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-xl"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl max-w-sm w-full"
                    >
                        {/* Animated Icon Circle */}
                        <div className={`w-20 h-20 rounded-full ${bgLightClass} flex items-center justify-center mb-6 relative`}>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className={`w-12 h-12 ${colorClass} rounded-full flex items-center justify-center ${shadowClass}`}
                            >
                                {isSuccess ? (
                                    <motion.svg
                                        viewBox="0 0 24 24"
                                        className="w-8 h-8 text-white"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        transition={{ delay: 0.4, duration: 0.5 }}
                                    >
                                        <motion.path
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M20 6L9 17l-5-5"
                                        />
                                    </motion.svg>
                                ) : (
                                    <AlertTriangle className="w-6 h-6 text-white" />
                                )}
                            </motion.div>
                            {/* Ripple Effect */}
                            <motion.div
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className={`absolute inset-0 rounded-full border ${borderClass}`}
                            />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">{message}</h2>
                        {subMessage && (
                            <p className="text-white/50 text-sm">{subMessage}</p>
                        )}

                        {!isSuccess && onClose && (
                            <button
                                onClick={onClose}
                                className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors"
                            >
                                Close
                            </button>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
