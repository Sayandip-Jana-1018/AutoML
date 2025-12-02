"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UploadCloud, FileText, FileSpreadsheet, File, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DragDropUploadProps {
    themeColor: string
}

export function DragDropUpload({ themeColor }: DragDropUploadProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0])
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const removeFile = () => {
        setFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-6 relative z-10">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                    "relative rounded-3xl overflow-hidden backdrop-blur-xl border border-white/20 shadow-2xl transition-all duration-500",
                    isDragging ? "scale-[1.02] border-white/40 shadow-white/10" : "hover:shadow-xl"
                )}
                style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    boxShadow: `0 0 40px -10px ${themeColor}20`
                }}
            >
                {/* Glass Reflection */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

                <div className="relative p-6 flex flex-col items-center justify-center text-center min-h-[300px]">

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".csv,.xlsx,.xls,.doc,.docx,.pdf,.txt,.json"
                    />

                    <AnimatePresence mode="wait">
                        {!file ? (
                            <motion.div
                                key="upload-prompt"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.3 }}
                                className="flex flex-col items-center gap-6 w-full"
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                <div
                                    className={cn(
                                        "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 mb-4",
                                        isDragging ? "bg-white/20 scale-110" : "bg-white/5"
                                    )}
                                    style={{
                                        boxShadow: isDragging ? `0 0 50px ${themeColor}40` : `0 0 0 transparent`
                                    }}
                                >
                                    <UploadCloud
                                        className="w-16 h-16 transition-colors duration-300"
                                        style={{ color: isDragging ? themeColor : 'rgba(255,255,255,0.7)' }}
                                    />
                                </div>

                                <h2 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                                    Upload your Dataset
                                </h2>

                                <p className="text-lg text-white/60 max-w-lg mb-8">
                                    Drag & drop your files here or click to browse.
                                    <br />
                                    <span className="text-sm opacity-70 mt-2 block">
                                        Supports CSV, Excel, Word, PDF, JSON
                                    </span>
                                </p>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg relative overflow-hidden group"
                                    style={{
                                        backgroundColor: themeColor,
                                        color: themeColor === '#ffffff' ? 'black' : 'white'
                                    }}
                                >
                                    <span className="relative z-10">Browse Files</span>
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="file-preview"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="flex flex-col items-center w-full"
                            >
                                <div
                                    className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center mb-6 border border-white/10 relative group"
                                >
                                    <FileText className="w-12 h-12 text-white" />
                                    <button
                                        onClick={removeFile}
                                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-2">{file.name}</h3>
                                <p className="text-white/50 mb-8">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>

                                <div className="flex gap-4">
                                    <button
                                        onClick={removeFile}
                                        className="px-6 py-3 rounded-full font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                                        style={{
                                            backgroundColor: themeColor,
                                            color: themeColor === '#ffffff' ? 'black' : 'white'
                                        }}
                                    >
                                        Process File
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30" />
            </motion.div>
        </div>
    )
}
