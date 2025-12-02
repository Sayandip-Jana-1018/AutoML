"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
    User, Bell, Lock, Camera, Edit2, Check, X, Database, BrainCircuit, Loader2, MapPin, Briefcase, Settings, LogOut, Plus, MoreVertical, ChevronRight, Shield
} from "lucide-react"
import Prism from "@/components/react-bits/Prism"

export default function ProfilePage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const { data: session, status } = useSession()
    const router = useRouter()

    const [editMode, setEditMode] = useState(false)
    const [profileData, setProfileData] = useState({
        name: "",
        email: "",
        bio: "",
        role: "AI Researcher",
        location: "San Francisco, CA",
        avatar: "",
        banner: "",
        datasets: [],
        models: []
    })
    const [tempData, setTempData] = useState(profileData)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)
    const [loading, setLoading] = useState(true)

    // View State: 'overview' (Datasets/Models), 'security', 'notifications'
    const [currentView, setCurrentView] = useState<'overview' | 'security' | 'notifications'>('overview')

    // Settings States
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" })

    // Modal State
    const [modalOpen, setModalOpen] = useState(false)
    const [modalType, setModalType] = useState<'models' | 'collaborators' | null>(null)

    // Mock Data for Models (User requested 4 models)
    // Fetch Models and enrich with feature counts
    useEffect(() => {
        if (status === "authenticated") {
            const fetchModels = async () => {
                try {
                    const res = await fetch('/api/proxy/models')
                    if (res.ok) {
                        const data = await res.json()
                        let modelsList = data.models || []

                        // Sort by accuracy (descending)
                        modelsList.sort((a: any, b: any) => {
                            const accA = a.metrics?.accuracy || 0
                            const accB = b.metrics?.accuracy || 0
                            return accB - accA
                        })

                        if (modelsList.length === 0) {
                            // Fallback Mock Data if API returns empty (for demo)
                            setProfileData(prev => ({
                                ...prev,
                                models: [
                                    { name: "MediScan AI", type: "Computer Vision", status: "Deployed", accuracy: 0.95 },
                                    { name: "HealthBot Pro", type: "NLP", status: "Deployed", accuracy: 0.88 },
                                    { name: "GenomicNet", type: "Bioinformatics", status: "Training", accuracy: 0.72 },
                                    { name: "PharmaPredict", type: "Predictive Analytics", status: "Deployed", accuracy: 0.91 }
                                ] as any
                            }))
                        } else {
                            setProfileData(prev => ({
                                ...prev,
                                models: modelsList.map((m: any) => ({
                                    name: `${m.target_column} Model`, // Use target column as name
                                    type: m.algorithm,
                                    status: "Deployed", // Assume deployed if in list
                                    accuracy: m.metrics?.accuracy,
                                    id: m.model_id
                                }))
                            }))
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch models", error)
                }
            }
            fetchModels()
        }
    }, [status])

    // Mock Collaborators
    const collaborators = [
        { name: "Sarah Chen", role: "Data Scientist", avatar: "https://i.pravatar.cc/150?u=sarah" },
        { name: "Alex Rivera", role: "ML Engineer", avatar: "https://i.pravatar.cc/150?u=alex" },
        { name: "Mike Ross", role: "Frontend Dev", avatar: "https://i.pravatar.cc/150?u=mike" },
        { name: "John Doe", role: "AI Researcher", avatar: "https://i.pravatar.cc/150?u=john" },
    ]

    // Fetch profile on mount
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login")
            return
        }

        if (status === "authenticated") {
            const fetchProfile = async () => {
                try {
                    const res = await fetch('/api/profile')
                    if (res.ok) {
                        const data = await res.json()
                        // Map 'image' from DB to 'avatar' for state
                        const mappedData = {
                            ...data,
                            avatar: data.image || data.avatar || ""
                        }
                        setProfileData(prev => ({ ...prev, ...mappedData }))
                        setTempData(prev => ({ ...prev, ...mappedData }))
                        if (data.themeColor) setThemeColor(data.themeColor)
                    }
                } catch (error) {
                    console.error("Failed to fetch profile", error)
                } finally {
                    setLoading(false)
                }
            }
            fetchProfile()
        }
    }, [status, router, setThemeColor])

    const handleSave = async () => {
        try {
            const dataToSave = { ...tempData, themeColor }
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            })
            if (res.ok) {
                const updated = await res.json()
                // Ensure we map the response back too
                const mappedUpdated = {
                    ...updated,
                    avatar: updated.image || updated.avatar || ""
                }
                setProfileData(prev => ({ ...prev, ...mappedUpdated }))
                setEditMode(false)
            }
        } catch (error) {
            console.error("Failed to save profile", error)
        }
    }

    const handleCancel = () => {
        setTempData(profileData)
        setEditMode(false)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setTempData(prev => ({ ...prev, [type]: reader.result as string }))
            }
            reader.readAsDataURL(file)
        }
    }

    const handlePasswordChange = () => {
        // Implement password change logic here
        console.log("Password change requested", passwordData)
        setPasswordData({ current: "", new: "", confirm: "" })
        alert("Password update simulated.")
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        )
    }



    const openModal = (type: 'models' | 'collaborators') => {
        setModalType(type)
        setModalOpen(true)
    }

    const closeModal = () => {
        setModalOpen(false)
        setModalType(null)
    }

    return (
        <>
            {/* ... existing Navbar/ThemeToggle ... */}
            <div className="fixed top-0 right-0 z-50">
                <ThemeToggle />
            </div>
            <div className="relative z-40">
                <Navbar />
            </div>

            {/* MODAL OVERLAY */}
            <AnimatePresence>
                {modalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={closeModal} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                {modalType === 'models' ? <BrainCircuit className="w-6 h-6 text-blue-400" /> : <User className="w-6 h-6 text-purple-400" />}
                                All {modalType === 'models' ? 'Models' : 'Collaborators'}
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {modalType === 'models' ? (
                                    profileData.models.map((model: any, i: number) => (
                                        <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                                    <BrainCircuit className="w-5 h-5" />
                                                </div>
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${model.status === 'Deployed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                    {model.status}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-white text-lg mb-1">{model.name}</h3>
                                            <p className="text-white/50 text-sm">{model.type}</p>
                                        </div>
                                    ))
                                ) : (
                                    collaborators.map((collab, i) => (
                                        <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-colors">
                                            <img src={collab.avatar} alt={collab.name} className="w-12 h-12 rounded-full" />
                                            <div>
                                                <div className="font-bold text-white">{collab.name}</div>
                                                <div className="text-sm text-white/50">{collab.role}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Prism Background */}
            <div className="fixed inset-0 z-0 top-[20%]">
                <Prism
                    scale={1.4}
                    height={5}
                    baseWidth={7}
                    glow={1}
                    noise={0.1}
                    animationType="rotate"
                    timeScale={0.3}
                />
            </div>

            <main className="relative z-10 min-h-screen flex flex-col items-center pt-24 pb-8 px-4 md:px-6 bg-transparent">

                {/* Main Glass Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-6xl bg-transparent backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col relative z-20"
                >


                    {/* --- 1. Hero Banner --- */}
                    <div className="relative h-48 w-full group shrink-0 z-10">
                        {/* Banner Image / Gradient */}
                        <div className="absolute inset-0">
                            {tempData.banner ? (
                                <img src={tempData.banner} alt="Banner" className="w-full h-full object-screen" />
                            ) : (
                                <div className="w-full h-full bg-white/5" />
                            )}
                        </div>
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-500" />

                        {/* Banner Edit Button */}
                        <button
                            onClick={() => bannerInputRef.current?.click()}
                            className="absolute top-6 right-6 p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-all border border-white/10 opacity-0 group-hover:opacity-100"
                        >
                            <Camera className="w-5 h-5" />
                        </button>
                        <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'banner')} />
                    </div>

                    {/* --- 2. Profile Header & Content --- */}
                    <div className="flex flex-col lg:flex-row flex-1 relative z-10">

                        {/* --- LEFT COLUMN: Profile Info & Stats --- */}
                        <div className="lg:w-1/3 p-6 -mt-32 relative z-20 flex flex-col gap-5">

                            {/* Avatar & Basic Info Card */}
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
                                {/* Avatar */}
                                <div className="relative group mb-4">
                                    <div className="w-48 h-48 rounded-full border-4 border-white/10 shadow-2xl overflow-hidden bg-white/5 relative">
                                        {tempData.avatar ? (
                                            <img src={tempData.avatar} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                <User className="w-20 h-20 text-white/30" />
                                            </div>
                                        )}
                                        <div
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Camera className="w-10 h-10 text-white" />
                                        </div>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'avatar')} />
                                </div>

                                {/* Name & Role */}
                                {editMode ? (
                                    <div className="space-y-3 w-full">
                                        <input
                                            value={tempData.name || ""}
                                            onChange={(e) => setTempData({ ...tempData, name: e.target.value })}
                                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-lg font-bold text-white w-full text-center focus:bg-white/10 transition-colors"
                                            placeholder="Name"
                                        />
                                        <input
                                            value={tempData.role || ""}
                                            onChange={(e) => setTempData({ ...tempData, role: e.target.value })}
                                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white/70 w-full text-center focus:bg-white/10 transition-colors"
                                            placeholder="Role"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-2xl font-bold text-white mb-1">{profileData.name || "User Name"}</h1>
                                        <p className="text-white/60 flex items-center gap-2 justify-center mb-4 text-sm">
                                            <Briefcase className="w-4 h-4" /> {profileData.role || "No Role"}
                                        </p>
                                    </>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-2 w-full">
                                    {editMode ? (
                                        <>
                                            <button onClick={handleSave} className="flex-1 py-2 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm">
                                                <Check className="w-4 h-4" /> Save
                                            </button>
                                            <button onClick={handleCancel} className="flex-1 py-2 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-sm">
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex gap-2 w-full">
                                            <button onClick={() => setEditMode(true)} className="flex-1 py-2 bg-white/10 border border-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-sm">
                                                <Edit2 className="w-4 h-4" /> Edit Profile
                                            </button>
                                            <button
                                                onClick={() => setCurrentView(currentView === 'security' ? 'overview' : 'security')}
                                                className={`p-2 rounded-xl border transition-colors ${currentView === 'security' ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                                            >
                                                <Settings className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Card */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex justify-between items-center">
                                <div className="text-center flex-1 border-r border-white/10">
                                    <div className="text-2xl font-black text-white">{profileData.datasets?.length || 0}</div>
                                    <div className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-1">Datasets</div>
                                </div>
                                <div className="text-center flex-1">
                                    <div className="text-2xl font-black text-white">{profileData.models?.length || 0}</div>
                                    <div className="text-[10px] text-white/50 uppercase tracking-wider font-bold mt-1">Models</div>
                                </div>
                            </div>

                            {/* Navigation / Menu */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                                <button
                                    onClick={() => setCurrentView('overview')}
                                    className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === 'overview' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span className="flex items-center gap-3 font-medium text-sm"><Database className="w-4 h-4" /> Overview</span>
                                    {currentView === 'overview' && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                                </button>
                                <div className="h-px bg-white/5" />
                                <button
                                    onClick={() => setCurrentView('security')}
                                    className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === 'security' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span className="flex items-center gap-3 font-medium text-sm"><Lock className="w-4 h-4" /> Security</span>
                                    {currentView === 'security' && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />}
                                </button>
                                <div className="h-px bg-white/5" />
                                <button
                                    onClick={() => setCurrentView('notifications')}
                                    className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === 'notifications' ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span className="flex items-center gap-3 font-medium text-sm"><Bell className="w-4 h-4" /> Notifications</span>
                                    {currentView === 'notifications' && <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                                </button>
                            </div>

                        </div>

                        {/* --- RIGHT COLUMN: Dynamic Content --- */}
                        <div className="lg:w-2/3 p-6 pt-4 lg:pt-6 flex flex-col justify-center min-h-[500px]">
                            <AnimatePresence mode="wait">

                                {/* VIEW: OVERVIEW (Models Only) */}
                                {currentView === 'overview' && (
                                    <motion.div
                                        key="overview"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6 h-full flex flex-col"
                                    >
                                        {/* Sign Out (Moved to Top) */}
                                        <div className="flex justify-end">
                                            <button onClick={() => signOut({ callbackUrl: "/" })} className="px-6 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/20 transition-colors flex items-center gap-2 group text-sm">
                                                <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Sign Out
                                            </button>
                                        </div>

                                        {/* Content Grid (Models) */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 content-start">
                                            {profileData.models.length > 0 ? (
                                                <>
                                                    {profileData.models.slice(0, 3).map((model: any, i: number) => (
                                                        <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-colors group cursor-pointer">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                                                                    <BrainCircuit className="w-6 h-6" />
                                                                </div>
                                                                <div className={`w-2 h-2 rounded-full ${model.status === 'Deployed' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                            </div>
                                                            <h3 className="font-bold text-white text-lg mb-1 truncate">{model.name}</h3>
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-white/50 text-sm">{model.type}</p>
                                                                {model.accuracy !== undefined && (
                                                                    <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                                                                        {(model.accuracy * 100).toFixed(1)}% Acc
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {profileData.models.length > 3 && (
                                                        <button
                                                            onClick={() => openModal('models')}
                                                            className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-3 group h-full min-h-[140px]"
                                                        >
                                                            <div className="p-4 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
                                                                <ChevronRight className="w-6 h-6 text-white" />
                                                            </div>
                                                            <span className="font-bold text-white text-sm">View All Models</span>
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="col-span-full bg-transparent border border-white/10 rounded-3xl p-10 text-center flex flex-col items-center justify-center border-dashed h-full">
                                                    <div className="w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full flex items-center justify-center mb-4">
                                                        <BrainCircuit className="w-8 h-8 text-white/30" />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-white mb-2">No Models Found</h3>
                                                    <p className="text-white/50 max-w-md mx-auto mb-6 text-sm">
                                                        You haven't created any models yet. Start by creating your first one.
                                                    </p>
                                                    <button
                                                        onClick={() => router.push('/studio')}
                                                        className="px-6 py-2.5 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
                                                    >
                                                        <Plus className="w-4 h-4" /> Create New Model
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Collaborators Section */}
                                        <div className="mt-6">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-base font-bold text-white">Recent Collaborators</h3>
                                                <button onClick={() => openModal('collaborators')} className="text-xs text-blue-400 hover:text-blue-300">View All</button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {collaborators.slice(0, 3).map((collab, i) => (
                                                    <div key={i} className="bg-transparent border border-white/10 p-3 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-colors cursor-pointer group">
                                                        <img src={collab.avatar} alt={collab.name} className="w-8 h-8 rounded-full" />
                                                        <div className="overflow-hidden">
                                                            <div className="font-bold text-white text-sm truncate group-hover:text-blue-400 transition-colors">{collab.name}</div>
                                                            <div className="text-[10px] text-white/50 truncate">{collab.role}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {collaborators.length > 3 && (
                                                    <button
                                                        onClick={() => openModal('collaborators')}
                                                        className="bg-transparent border border-white/10 p-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors group"
                                                    >
                                                        <div className="p-1.5 bg-white/10 rounded-full">
                                                            <ChevronRight className="w-4 h-4 text-white" />
                                                        </div>
                                                        <span className="font-bold text-white text-xs">View All</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* VIEW: SECURITY (Change Password) */}
                                {currentView === 'security' && (
                                    <motion.div
                                        key="security"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="max-w-lg mx-auto w-full"
                                    >
                                        <div className="bg-transparent border border-white/10 rounded-[2rem] p-8">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400">
                                                    <Shield className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-white">Security Settings</h2>
                                                    <p className="text-white/50 text-base">Manage your password and account security</p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-white/70 ml-1">Current Password</label>
                                                    <input
                                                        type="password"
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:bg-black/40 transition-all outline-none text-base"
                                                        value={passwordData.current || ""}
                                                        onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-white/70 ml-1">New Password</label>
                                                    <input
                                                        type="password"
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:bg-black/40 transition-all outline-none text-base"
                                                        value={passwordData.new || ""}
                                                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-white/70 ml-1">Confirm New Password</label>
                                                    <input
                                                        type="password"
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500/50 focus:bg-black/40 transition-all outline-none text-base"
                                                        value={passwordData.confirm || ""}
                                                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                                    />
                                                </div>

                                                <div className="pt-6 flex gap-3">
                                                    <button onClick={handlePasswordChange} className="flex-1 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors text-base">
                                                        Update Password
                                                    </button>
                                                    <button onClick={() => setCurrentView('overview')} className="px-6 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors text-base">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* VIEW: NOTIFICATIONS */}
                                {currentView === 'notifications' && (
                                    <motion.div
                                        key="notifications"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="max-w-lg mx-auto w-full"
                                    >
                                        <div className="bg-transparent border border-white/10 rounded-[2rem] p-8">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="p-3 bg-green-500/20 rounded-2xl text-green-400">
                                                    <Bell className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-white">Notification Preferences</h2>
                                                    <p className="text-white/50 text-base">Choose what updates you want to receive</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {['Email Notifications', 'Push Notifications', 'Product Updates', 'Security Alerts'].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                                                        <span className="font-medium text-white/80 text-base">{item}</span>
                                                        <button
                                                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                                            className={`w-12 h-6 rounded-full relative transition-colors flex items-center ${notificationsEnabled ? 'bg-green-500' : 'bg-white/10'}`}
                                                        >
                                                            <div className={`absolute w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'left-7' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>

                    </div>
                </motion.div>
            </main>
        </>
    )
}
