"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"

interface SuccessModalProps {
    isOpen: boolean
    message: string
    subMessage?: string
    onClose?: () => void
}

export default function SuccessModal({ isOpen, message, subMessage, onClose }: SuccessModalProps) {
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
                        {/* Animated Tick Circle */}
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6 relative">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                            >
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
                            </motion.div>
                            {/* Ripple Effect */}
                            <motion.div
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 rounded-full border border-green-500/50"
                            />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">{message}</h2>
                        {subMessage && (
                            <p className="text-white/50 text-sm">{subMessage}</p>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
