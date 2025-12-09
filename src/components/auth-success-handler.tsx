"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import SuccessModal from "@/components/ui/success-modal"

export default function AuthSuccessHandler() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        if (searchParams?.get("login") === "success") {
            setShowSuccess(true)

            // Clean up the URL without reloading the page
            const newUrl = window.location.pathname
            window.history.replaceState({}, "", newUrl)
        }
    }, [searchParams, router])

    return (
        <SuccessModal
            isOpen={showSuccess}
            message="Successfully Signed In"
            subMessage="Welcome back to AutoForgeML Studio"
            onClose={() => setShowSuccess(false)}
        />
    )
}
