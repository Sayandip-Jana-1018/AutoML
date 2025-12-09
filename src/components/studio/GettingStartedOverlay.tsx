"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Upload,
    Wand2,
    Code,
    Play,
    Check,
    ArrowRight,
    Sparkles
} from "lucide-react";

interface Step {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
}

const STEPS: Step[] = [
    {
        id: 1,
        title: "Upload Your Dataset",
        description: "Drag and drop a CSV file or click to browse. We'll automatically detect column types and task type.",
        icon: <Upload className="w-6 h-6" />
    },
    {
        id: 2,
        title: "Choose a Template or Customize",
        description: "Select a pre-configured pipeline template, or use chat commands to customize your model configuration.",
        icon: <Wand2 className="w-6 h-6" />
    },
    {
        id: 3,
        title: "Review Generated Code",
        description: "We generate a complete train.py script. Review, modify, and approve the code before training.",
        icon: <Code className="w-6 h-6" />
    },
    {
        id: 4,
        title: "Start Training",
        description: "Click start to submit your job to Vertex AI. Monitor progress and logs in real-time.",
        icon: <Play className="w-6 h-6" />
    }
];

interface GettingStartedOverlayProps {
    onClose: () => void;
    onComplete: () => void;
}

export function GettingStartedOverlay({ onClose, onComplete }: GettingStartedOverlayProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed
        const dismissed = localStorage.getItem('adhyay_getting_started_dismissed');
        if (dismissed === 'true') {
            setIsDismissed(true);
            onComplete();
        }
    }, [onComplete]);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        localStorage.setItem('adhyay_getting_started_dismissed', 'true');
        setIsDismissed(true);
        onComplete();
    };

    const handleSkip = () => {
        localStorage.setItem('adhyay_getting_started_dismissed', 'true');
        onClose();
    };

    if (isDismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Getting Started</h2>
                                    <p className="text-sm text-gray-400">Learn how to train your first model</p>
                                </div>
                            </div>
                            <button
                                onClick={handleSkip}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Progress Dots */}
                    <div className="flex items-center justify-center gap-2 py-4 bg-black/20">
                        {STEPS.map((step, i) => (
                            <button
                                key={step.id}
                                onClick={() => setCurrentStep(i)}
                                className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentStep
                                    ? 'bg-blue-500 w-8'
                                    : i < currentStep
                                        ? 'bg-green-500'
                                        : 'bg-white/20'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Step Content */}
                    <div className="p-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center"
                            >
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                    {STEPS[currentStep].icon}
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-4">
                                    {STEPS[currentStep].title}
                                </h3>

                                <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
                                    {STEPS[currentStep].description}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-white/10 bg-black/20">
                        <button
                            onClick={handleSkip}
                            className="text-sm text-gray-500 hover:text-gray-300"
                        >
                            Skip tutorial
                        </button>

                        <div className="flex items-center gap-3">
                            {currentStep > 0 && (
                                <button
                                    onClick={() => setCurrentStep(prev => prev - 1)}
                                    className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5"
                                >
                                    Back
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                            >
                                {currentStep === STEPS.length - 1 ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Get Started
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default GettingStartedOverlay;
