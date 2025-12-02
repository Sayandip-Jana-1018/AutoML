"use server"

import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { SignJWT } from "jose"

export async function authenticate(email: string, password: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user || !user.password) {
            return { success: false, error: "Invalid credentials" }
        }

        const isValid = await bcrypt.compare(password, user.password)

        if (!isValid) {
            return { success: false, error: "Invalid credentials" }
        }

        // Create a simple session token
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "fallback-secret")
        const token = await new SignJWT({
            sub: user.id,
            email: user.email,
            name: user.name
        })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("7d")
            .sign(secret)

        // Set session cookie
        const cookieStore = await cookies()
        cookieStore.set("next-auth.session-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: "/",
        })

        return { success: true, user: { id: user.id, email: user.email, name: user.name } }
    } catch (error) {
        console.error("[Auth] Error:", error)
        return { success: false, error: "Something went wrong" }
    }
}
