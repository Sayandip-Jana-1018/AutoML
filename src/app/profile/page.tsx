"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import { Navbar } from "@/components/navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import {
    User, Bell, Lock, Camera, Edit2, Check, X, Database, BrainCircuit, Loader2, MapPin, Briefcase, Settings, LogOut, Plus, MoreVertical, ChevronRight, Shield, Users
} from "lucide-react"
import Prism from "@/components/react-bits/Prism"
import { db, storage, auth } from "@/lib/firebase"
import { updateProfile } from "firebase/auth"
import { doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { ref, uploadString, getDownloadURL } from "firebase/storage"
import { ModelsGrid, DatasetsGrid, SecuritySettings } from "@/components/profile"

export default function ProfilePage() {
    const { themeColor, setThemeColor } = useThemeColor()
    const { user, logout, loading: authLoading } = useAuth()
    const router = useRouter()

    const [editMode, setEditMode] = useState(false)
    const [showSaveSuccess, setShowSaveSuccess] = useState(false)
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

    // Real Firestore Data
    const [userModels, setUserModels] = useState<any[]>([])
    const [userDatasets, setUserDatasets] = useState<any[]>([])
    const [loadingAssets, setLoadingAssets] = useState(true)

    // View State: 'overview' (Datasets/Models), 'security', 'notifications'
    const [currentView, setCurrentView] = useState<'overview' | 'security' | 'notifications'>('overview')

    // Settings States
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" })

    // Modal State
    const [modalOpen, setModalOpen] = useState(false)
    const [modalType, setModalType] = useState<'models' | 'collaborators' | null>(null)

    // Collaborators state (coming from projects)
    const [collaborators, setCollaborators] = useState<any[]>([])
    const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false)

    // Fetch profile on mount
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push("/auth/login")
                return
            }

            const fetchProfile = async () => {
                try {
                    const docRef = doc(db, "users", user.uid)

                    // Create a timeout promise that rejects after 2 seconds
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Timeout")), 2000)
                    )

                    let data = {}
                    try {
                        // Race between Firestore fetch and timeout
                        const docSnap = await Promise.race([
                            getDoc(docRef),
                            timeoutPromise
                        ]) as any

                        if (docSnap.exists()) {
                            data = docSnap.data()
                        }
                    } catch (err: any) {
                        console.warn("Profile fetch timed out or failed (using Auth fallback):", err)
                        // Fallback to Auth data is handled below
                    }

                    const mappedData = {
                        ...profileData,
                        ...data,
                        name: (data as any).displayName || (data as any).name || user.displayName || "User",
                        email: user.email || (data as any).email || "No email provided",
                        avatar: (data as any).photoURL || (data as any).avatar || user.photoURL || "",
                        models: (data as any).models || []
                    }
                    setProfileData(mappedData)
                    setTempData(mappedData)
                    // Use user's saved color or fallback to cyan
                    setThemeColor((data as any).themeColor || "#06B6D4")

                } catch (error) {
                    console.error("Critical error in fetchProfile", error)
                } finally {
                    setLoading(false)
                }
            }
            fetchProfile()
        }
    }, [user, authLoading, router, setThemeColor])

    // Fetch user's deployed models and datasets from Firestore
    useEffect(() => {
        if (!user?.email) return

        setLoadingAssets(true)

        // Listen to models collection filtered by user email
        const modelsQuery = query(
            collection(db, 'models'),
            where('user_email', '==', user.email),
            orderBy('created_at', 'desc')
        )

        const unsubModels = onSnapshot(modelsQuery, (snapshot) => {
            const models = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                name: doc.data().target_column ? `${doc.data().target_column} Model` : 'Untitled Model',
                type: doc.data().algorithm || 'Unknown',
                status: 'Deployed',
                accuracy: doc.data().metrics?.accuracy
            }))
            setUserModels(models)
            setLoadingAssets(false)
        }, (err) => {
            console.error('Error fetching models:', err)
            setLoadingAssets(false)
        })

        // Listen to all projects and their datasets
        const projectsQuery = query(
            collection(db, 'projects'),
            where('owner_email', '==', user.email),
            orderBy('created_at', 'desc')
        )

        const unsubProjects = onSnapshot(projectsQuery, async (snapshot) => {
            const allDatasets: any[] = []
            for (const projectDoc of snapshot.docs) {
                // Use getDocs for subcollection with v9 syntax
                const { getDocs } = await import('firebase/firestore')
                const datasetsRef = collection(db, 'projects', projectDoc.id, 'datasets')
                const datasetsSnap = await getDocs(datasetsRef)
                datasetsSnap.forEach((dsDoc: any) => {
                    allDatasets.push({
                        id: dsDoc.id,
                        projectId: projectDoc.id,
                        ...dsDoc.data()
                    })
                })
            }
            setUserDatasets(allDatasets)
        }, (err) => {
            console.warn('Error fetching datasets:', err)
        })

        return () => {
            unsubModels()
            unsubProjects()
        }
    }, [user])

    const handleSave = async () => {
        if (!user) return
        try {
            const dataToSave = { ...tempData, themeColor }
            await setDoc(doc(db, "users", user.uid), dataToSave, { merge: true })

            setProfileData(prev => ({ ...prev, ...dataToSave }))
            setEditMode(false)
            setShowSaveSuccess(true)
            setTimeout(() => setShowSaveSuccess(false), 2000)
        } catch (error) {
            console.error("Failed to save profile", error)
        }
    }

    const handleCancel = () => {
        setTempData(profileData)
        setEditMode(false)
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = e.target.files?.[0]
        if (file && user) {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const result = reader.result as string
                // Update local state immediately for preview
                setTempData(prev => ({ ...prev, [type]: result }))

                // Upload to Firebase Storage
                try {
                    const storageRef = ref(storage, `${type}s/${user.uid}`)
                    await uploadString(storageRef, result, 'data_url')
                    const downloadURL = await getDownloadURL(storageRef)

                    // Update Firestore with new URL
                    await setDoc(doc(db, "users", user.uid), { [type === 'avatar' ? 'photoURL' : type]: downloadURL }, { merge: true })

                    // ALSO Update Auth Profile for Avatar (Backup Persistence)
                    if (type === 'avatar') {
                        await updateProfile(user, { photoURL: downloadURL })
                    }

                    // Update profile data with remote URL
                    setProfileData(prev => ({ ...prev, [type]: downloadURL }))
                    setTempData(prev => ({ ...prev, [type]: downloadURL }))
                } catch (error) {
                    console.error(`Error uploading ${type}:`, error)
                    alert(`Failed to upload image. Ensure Firebase Storage is enabled in Console. Error: ${error}`)
                }
            }
            reader.readAsDataURL(file)
        }
    }

    const handlePasswordChange = () => {
        // Implement password change logic here
        console.log("Password change requested", passwordData)
        setPasswordData({ current: "", new: "", confirm: "" })
        alert("Password update simulated. Use Forgot Password for actual reset.")
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black text-black dark:text-white">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        )
    }

    // Success Animation Overlay
    const SuccessOverlay = () => (
        <AnimatePresence>
            {showSaveSuccess && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed bottom-10 right-10 z-[100] bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold"
                >
                    <div className="bg-white/20 p-1 rounded-full">
                        <Check className="w-4 h-4" />
                    </div>
                    Profile Saved Successfully
                </motion.div>
            )}
        </AnimatePresence>
    )

    const openModal = (type: 'models') => {
        setModalType(type)
        setModalOpen(true)
    }

    const closeModal = () => {
        setModalOpen(false)
        setModalType(null)
    }

    return (
        <>
            <div className="fixed bg-black/10 dark:bg-white/10 text-black dark:text-white top-0 right-0 z-50">
                <ThemeToggle />
            </div>
            <div className="relative z-40">
                <Navbar />
            </div>

            {/* MODAL OVERLAY - All Models */}
            <AnimatePresence>
                {modalOpen && modalType === 'models' && (
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
                                <BrainCircuit className="w-6 h-6 text-blue-400" />
                                All Deployed Models ({userModels.length})
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {userModels.map((model: any, i: number) => (
                                    <div key={model.id || i} className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                                <BrainCircuit className="w-5 h-5" />
                                            </div>
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                                                {model.status || 'Deployed'}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-white text-lg mb-1">{model.name}</h3>
                                        <p className="text-white/50 text-sm">{model.type}</p>
                                        {model.accuracy && (
                                            <p className="text-xs text-green-400 mt-2">{(model.accuracy * 100).toFixed(1)}% Accuracy</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Prism Background */}
            <div className="fixed inset-0 z-0 top-[20%]">
                <Prism
                    scale={1.8}
                    height={5}
                    baseWidth={7}
                    glow={1}
                    bloom={1.2}
                    noise={0.1}
                    animationType="rotate"
                    timeScale={0.3}
                />
            </div>

            <main className="relative z-10 min-h-screen flex flex-col items-center pt-24 pb-8 px-4 md:px-6">
                <SuccessOverlay />
                {/* Main Glass Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-6xl bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col relative z-20"
                >


                    {/* --- 1. Hero Banner --- */}
                    <div className="relative h-48 w-full group shrink-0 z-10">
                        {/* Banner Image / Gradient */}
                        <div className="absolute inset-0">
                            {tempData.banner ? (
                                <img src={tempData.banner} alt="Banner" className="w-full h-full object-screen" />
                            ) : (
                                <div className="w-full h-full bg-black/5 dark:bg-white/5" />
                            )}
                        </div>
                        <div className="absolute inset-0 duration-500" />

                        {/* Banner Edit Button */}
                        <button
                            onClick={() => bannerInputRef.current?.click()}
                            className="absolute top-6 right-6 p-3 bg-black/30 dark:bg-white/30 hover:bg-black/50 backdrop-blur-md rounded-full text-black dark:text-white/80 hover:text-black dark:text-white transition-all border border-black/10 dark:border-white/10 opacity-0 group-hover:opacity-100"
                        >
                            <Camera className="w-5 h-5" />
                        </button>
                        <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'banner')} />
                    </div>

                    {/* --- 2. Profile Header & Content --- */}
                    <div className="flex flex-col lg:flex-row flex-1 relative z-10">

                        {/* --- LEFT COLUMN: Profile Info & Stats --- */}
                        <div className="lg:w-1/3 p-6 -mt-36 relative z-20 flex flex-col gap-5">

                            {/* Avatar & Basic Info Card */}
                            <div className="bg-black/5 dark:bg-white/5 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
                                {/* Avatar */}
                                <div className="relative group mb-4">
                                    <div className="w-48 h-48 rounded-full border-4 border-black dark:border-white shadow-2xl overflow-hidden bg-black/5 dark:bg-white/5 relative">
                                        {tempData.avatar ? (
                                            <img src={tempData.avatar} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-black/5 dark:bg-white/5">
                                                <User className="w-20 h-20 text-black dark:text-white/30" />
                                            </div>
                                        )}
                                        <div
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Camera className="w-10 h-10 text-black dark:text-white" />
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
                                            className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-xl px-4 py-2 text-lg font-bold text-black dark:text-white w-full text-center focus:bg-black/10 dark:bg-white/10 transition-colors"
                                            placeholder="Name"
                                        />
                                        <div className="flex flex-col gap-2">
                                            <div className="relative">
                                                <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-black/40 dark:text-white/40" />
                                                <input
                                                    value={tempData.role || ""}
                                                    onChange={(e) => setTempData({ ...tempData, role: e.target.value })}
                                                    className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-xl pl-10 pr-4 py-2 text-black dark:text-white/70 w-full text-left focus:bg-black/10 dark:bg-white/10 transition-colors"
                                                    placeholder="Role (e.g. AI Researcher)"
                                                />
                                            </div>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-black/40 dark:text-white/40" />
                                                <input
                                                    value={tempData.location || ""}
                                                    onChange={(e) => setTempData({ ...tempData, location: e.target.value })}
                                                    className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-xl pl-10 pr-4 py-2 text-black dark:text-white/70 w-full text-left focus:bg-black/10 dark:bg-white/10 transition-colors"
                                                    placeholder="Location (e.g. San Francisco)"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-2xl font-bold text-black dark:text-white mb-1">{profileData.name || "User Name"}</h1>
                                        <p className="text-black/60 dark:text-white/40 text-sm mb-4 font-medium">{profileData.email}</p>

                                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                                            {profileData.role && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full text-sm text-black/80 dark:text-white/70 backdrop-blur-sm">
                                                    <Briefcase className="w-3.5 h-3.5" />
                                                    <span>{profileData.role}</span>
                                                </div>
                                            )}
                                            {profileData.location && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full text-sm text-black/80 dark:text-white/70 backdrop-blur-sm">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span>{profileData.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-2 w-full">
                                    {editMode ? (
                                        <>
                                            <button onClick={handleSave} className="flex-1 py-2 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm">
                                                <Check className="w-4 h-4" /> Save
                                            </button>
                                            <button onClick={handleCancel} className="flex-1 py-2 bg-black/10 dark:bg-white/10 text-black dark:text-white rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-sm">
                                                <X className="w-4 h-4" /> Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex gap-2 w-full">
                                            <button onClick={() => setEditMode(true)} className="flex-1 py-2 bg-black/10 dark:bg-white/10 border border-black dark:border-white text-black dark:text-white rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 text-sm">
                                                <Edit2 className="w-4 h-4" /> Edit Profile
                                            </button>
                                            <button
                                                onClick={() => setCurrentView(currentView === 'security' ? 'overview' : 'security')}
                                                className={`p-2 rounded-xl border transition-colors ${currentView === 'security' ? 'bg-white text-black border-white' : 'bg-black/5 dark:bg-white/5 border-black dark:border-white text-black dark:text-white hover:bg-black/10 dark:bg-white/10'}`}
                                            >
                                                <Settings className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Card */}
                            <div className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-3xl p-5 flex justify-between items-center">
                                <div className="text-center flex-1 border-r border-black dark:border-white">
                                    <div className="text-2xl font-black text-black dark:text-white">{profileData.datasets?.length || 0}</div>
                                    <div className="text-[10px] text-black/70 dark:text-white/50 uppercase tracking-wider font-bold mt-1">Datasets</div>
                                </div>
                                <div className="text-center flex-1">
                                    <div className="text-2xl font-black text-black dark:text-white">{profileData.models?.length || 0}</div>
                                    <div className="text-[10px] text-black/70 dark:text-white/50 uppercase tracking-wider font-bold mt-1">Models</div>
                                </div>
                            </div>

                            {/* Navigation / Menu */}
                            <div className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-3xl overflow-hidden">
                                <button
                                    onClick={() => setCurrentView('overview')}
                                    className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === 'overview' ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black dark:text-white/60 hover:bg-black/5 dark:bg-white/5 hover:text-black dark:text-white'}`}
                                >
                                    <span className="flex items-center gap-3 font-medium text-sm"><Database className="w-4 h-4" /> Overview</span>
                                    {currentView === 'overview' && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                                </button>
                                <div className="h-px bg-black/5 dark:bg-white/5" />
                                <button
                                    onClick={() => setCurrentView('security')}
                                    className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === 'security' ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black dark:text-white/60 hover:bg-black/5 dark:bg-white/5 hover:text-black dark:text-white'}`}
                                >
                                    <span className="flex items-center gap-3 font-medium text-sm"><Lock className="w-4 h-4" /> Security</span>
                                    {currentView === 'security' && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />}
                                </button>
                                <div className="h-px bg-black/5 dark:bg-white/5" />
                                <button
                                    onClick={() => setCurrentView('notifications')}
                                    className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === 'notifications' ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black dark:text-white/60 hover:bg-black/5 dark:bg-white/5 hover:text-black dark:text-white'}`}
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
                                            <button onClick={logout} className="px-6 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-500/20 transition-colors flex items-center gap-2 group text-sm">
                                                <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Sign Out
                                            </button>
                                        </div>

                                        {/* Using ModelsGrid Component */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 content-start">
                                            <ModelsGrid
                                                models={userModels}
                                                loading={loadingAssets}
                                                onViewAll={() => openModal('models')}
                                            />
                                        </div>

                                        {/* Using DatasetsGrid Component */}
                                        <DatasetsGrid datasets={userDatasets} />

                                        {/* Collaborators Section */}
                                        <div className="mt-6">
                                            <button
                                                onClick={() => setShowCollaboratorsModal(true)}
                                                className="w-full flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
                                                        <Users className="w-4 h-4" style={{ color: themeColor }} />
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="text-sm font-bold text-black dark:text-white">Collaborators</h3>
                                                        <p className="text-black/50 dark:text-white/50 text-[10px]">View project contributors</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-black/30 dark:text-white/30 group-hover:translate-x-1 transition-transform" />
                                            </button>

                                            {/* Skeleton Preview Cards */}
                                            <div className="grid grid-cols-3 gap-2 mt-3">
                                                {[1, 2, 3].map((i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2 animate-pulse"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10" />
                                                            <div className="flex-1 space-y-1">
                                                                <div className="h-2 bg-black/10 dark:bg-white/10 rounded w-3/4" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                    </motion.div>
                                )}

                                {/* VIEW: SECURITY */}
                                {currentView === 'security' && (
                                    <SecuritySettings userEmail={profileData.email || user?.email || ''} />
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
                                        <div className="bg-transparent border border-black dark:border-white rounded-[2rem] p-8">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="p-3 bg-green-500/20 rounded-2xl text-green-400">
                                                    <Bell className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-black dark:text-white">Notification Preferences</h2>
                                                    <p className="text-black dark:text-white/50 text-base">Choose what updates you want to receive</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {['Email Notifications', 'Push Notifications', 'Product Updates', 'Security Alerts'].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between p-4 bg-black/20 dark:bg-white/20 rounded-2xl border border-white/5">
                                                        <span className="font-medium text-black dark:text-white/80 text-base">{item}</span>
                                                        <button
                                                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                                            className={`w-12 h-6 rounded-full relative transition-colors flex items-center ${notificationsEnabled ? 'bg-green-500' : 'bg-black/10 dark:bg-white/10'}`}
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

            {/* Collaborators Modal Overlay */}
            <AnimatePresence>
                {showCollaboratorsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        onClick={() => setShowCollaboratorsModal(false)}
                    >
                        {/* Blur Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", bounce: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl"
                            style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${themeColor}20` }}>
                                        <Users className="w-5 h-5" style={{ color: themeColor }} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Project Collaborators</h2>
                                        <p className="text-white/50 text-xs">People who contribute to your projects</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCollaboratorsModal(false)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5 text-white/60" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                                {collaborators.length === 0 ? (
                                    // Placeholder Cards when no collaborators
                                    <>
                                        {[1, 2, 3].map((i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl animate-pulse"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-white/10" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-white/10 rounded w-1/3" />
                                                    <div className="h-3 bg-white/10 rounded w-1/2" />
                                                </div>
                                                <div className="text-right space-y-2">
                                                    <div className="h-5 bg-white/10 rounded-full w-16" />
                                                    <div className="h-3 bg-white/10 rounded w-20" />
                                                </div>
                                            </div>
                                        ))}
                                        <p className="text-center text-white/30 text-xs mt-4">
                                            Collaborator data will be synced when you share projects
                                        </p>
                                    </>
                                ) : (
                                    // Actual Collaborators
                                    collaborators.map((collab, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors"
                                        >
                                            <img
                                                src={collab.avatar || `https://ui-avatars.com/api/?name=${collab.name}&background=random`}
                                                alt={collab.name}
                                                className="w-12 h-12 rounded-full object-cover border-2"
                                                style={{ borderColor: themeColor }}
                                            />
                                            <div className="flex-1">
                                                <h4 className="font-bold text-white">{collab.name}</h4>
                                                <p className="text-white/50 text-sm">{collab.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <span
                                                    className="px-3 py-1 rounded-full text-xs font-bold"
                                                    style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                                                >
                                                    {collab.role || 'Contributor'}
                                                </span>
                                                {collab.lastEdited && (
                                                    <p className="text-white/30 text-[10px] mt-1">
                                                        Last edited: {new Date(collab.lastEdited).toLocaleDateString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
