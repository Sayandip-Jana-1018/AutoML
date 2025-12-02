"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginAction(formData: FormData) {
    try {
        console.log("[Action] Attempting login...")
        await signIn("credentials", {
            ...Object.fromEntries(formData),
            redirectTo: "/",
        })
        console.log("[Action] Login successful, redirecting...")
    } catch (error) {
        // We only log real errors, not the special NEXT_REDIRECT error which is actually a success signal
        const isRedirect = (error as any)?.digest?.startsWith("NEXT_REDIRECT")
        if (!isRedirect) {
            console.log("[Action] Caught error:", error)
        }

        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Invalid credentials." }
                default:
                    return { error: "Something went wrong." }
            }
        }
        throw error
    }
}
