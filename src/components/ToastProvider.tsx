'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, X, Zap } from 'lucide-react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'automl';
    title: string;
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (toast: Omit<Toast, 'id'>) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { ...toast, id }]);

        // Auto dismiss
        setTimeout(() => {
            hideToast(id);
        }, toast.duration || 5000);
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const getIcon = (type: Toast['type']) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-6 h-6 text-green-400" />;
            case 'error': return <XCircle className="w-6 h-6 text-red-400" />;
            case 'info': return <AlertCircle className="w-6 h-6 text-blue-400" />;
            case 'automl': return <Zap className="w-6 h-6 text-yellow-400" />;
        }
    };

    const getColors = (type: Toast['type']) => {
        switch (type) {
            case 'success': return { border: 'border-green-500/30', bg: 'bg-green-500/10', glow: '#10B981' };
            case 'error': return { border: 'border-red-500/30', bg: 'bg-red-500/10', glow: '#EF4444' };
            case 'info': return { border: 'border-blue-500/30', bg: 'bg-blue-500/10', glow: '#3B82F6' };
            case 'automl': return { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', glow: '#F59E0B' };
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 max-w-md">
                <AnimatePresence>
                    {toasts.map(toast => {
                        const colors = getColors(toast.type);
                        return (
                            <motion.div
                                key={toast.id}
                                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className={`relative backdrop-blur-xl ${colors.bg} ${colors.border} border rounded-2xl p-4 shadow-2xl`}
                                style={{ boxShadow: `0 0 40px ${colors.glow}30` }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {getIcon(toast.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-white text-sm">{toast.title}</h4>
                                        <p className="text-white/70 text-sm mt-1 whitespace-pre-line">{toast.message}</p>
                                    </div>
                                    <button
                                        onClick={() => hideToast(toast.id)}
                                        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Progress bar */}
                                <motion.div
                                    initial={{ width: '100%' }}
                                    animate={{ width: '0%' }}
                                    transition={{ duration: (toast.duration || 5000) / 1000, ease: 'linear' }}
                                    className="absolute bottom-0 left-0 h-1 rounded-full"
                                    style={{ backgroundColor: colors.glow }}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export default ToastProvider;
