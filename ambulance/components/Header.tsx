import React from 'react';
import { Phone, ShieldAlert } from 'lucide-react';

interface HeaderProps {
    isSidebarOpen?: boolean;
    setIsSidebarOpen?: (isOpen: boolean) => void;
}

export function Header({ isSidebarOpen, setIsSidebarOpen }: HeaderProps) {
    return (
        <header className="absolute top-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-6 px-6 py-3 bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-full shadow-2xl">

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                        <ShieldAlert className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg ml-8 text-center font-bold text-white leading-none">Emergency Response</h1>
                        <p className="text-xs ml-8 text-center text-slate-400 font-medium tracking-wide">AI-POWERED DISPATCH</p>
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-700/50 mx-2" />

                <div className="flex items-center gap-3">
                    <button className="w-10 h-10 rounded-full bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center text-red-400 transition-colors border border-slate-700/50">
                        <Phone size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
}
