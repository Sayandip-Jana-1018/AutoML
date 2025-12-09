"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { User, onAuthStateChanged, signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"
import { useRouter } from "next/navigation"

export type UserTier = 'free' | 'silver' | 'gold'

interface AuthContextType {
    user: User | null
    loading: boolean
    userTier: UserTier
    tierLoading: boolean
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    userTier: 'free',
    tierLoading: true,
    logout: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [userTier, setUserTier] = useState<UserTier>('free')
    const [tierLoading, setTierLoading] = useState(true)
    const router = useRouter()

    // Listen to auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setLoading(false)
        })

        return () => unsubscribe()
    }, [])

    // Listen to user tier from Firestore
    useEffect(() => {
        if (!user?.uid) {
            setUserTier('free')
            setTierLoading(false)
            return
        }

        setTierLoading(true)
        const userDocRef = doc(db, 'users', user.uid)

        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data()
                const tier = data.tier as UserTier
                if (tier && ['free', 'silver', 'gold'].includes(tier)) {
                    setUserTier(tier)
                } else {
                    setUserTier('free')
                }
            } else {
                setUserTier('free')
            }
            setTierLoading(false)
        }, (error) => {
            console.error("Error fetching user tier:", error)
            setUserTier('free')
            setTierLoading(false)
        })

        return () => unsubscribe()
    }, [user?.uid])

    const logout = async () => {
        try {
            await signOut(auth)
            setUserTier('free')
            router.push("/auth/login")
        } catch (error) {
            console.error("Error signing out:", error)
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, userTier, tierLoading, logout }}>
            {children}
        </AuthContext.Provider>
    )
}
