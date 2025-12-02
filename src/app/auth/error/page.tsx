"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

function ErrorContent() {
    const searchParams = useSearchParams()
    const error = searchParams?.get("error")

    let errorMessage = "An unknown error occurred."
    if (error === "Configuration") {
        errorMessage = "There is a problem with the server configuration. Check if your DB connection or API keys are correct."
    } else if (error === "AccessDenied") {
        errorMessage = "Access denied. You do not have permission to sign in."
    } else if (error === "Verification") {
        errorMessage = "The verification token has expired or has already been used."
    } else if (error === "OAuthSignin") {
        errorMessage = "Error in constructing an authorization URL."
    } else if (error === "OAuthCallback") {
        errorMessage = "Error in handling the response from the OAuth provider."
    } else {
        errorMessage = error || "Something went wrong."
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
            <div className="max-w-md w-full bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-8 text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
                <p className="text-white/60 mb-8">{errorMessage}</p>
                <Link
                    href="/auth/login"
                    className="inline-block px-6 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                >
                    Back to Login
                </Link>
            </div>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ErrorContent />
        </Suspense>
    )
}
