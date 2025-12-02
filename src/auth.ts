import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    session: { strategy: "jwt" },
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account, profile }) {
            // Only handle OAuth providers we care about
            if (account?.provider === "google" || account?.provider === "github" || account?.provider === "azure-ad") {
                try {
                    // If provider returned email on user already, use it.
                    let email: string | null = user?.email ?? null

                    // Try common profile fields returned by Microsoft
                    if (!email && profile) {
                        email = (profile.email as string) || (profile.preferred_username as string) || (profile.upn as string) || null
                    }

                    // If still not found, try decoding the id_token (server-side) to extract email
                    if (!email && account?.id_token) {
                        try {
                            // Minimal JWT decode (server-side). Note: this does NOT verify the token.
                            const parts = (account.id_token as string).split(".")
                            if (parts.length >= 2) {
                                const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"))
                                email = (payload?.email as string) || (payload?.preferred_username as string) || (payload?.upn as string) || null
                            }
                        } catch (e) {
                            console.warn("[Auth] Failed to decode id_token for email extraction", e)
                        }
                    }

                    if (!email) {
                        console.error("[Auth] OAuth user has no email (provider:", account?.provider, "profile keys:", Object.keys(profile || {}), ")")
                        return false // AccessDenied
                    }

                    // Ensure user.email exists for downstream logic
                    user.email = email

                    // Create or find user in DB
                    const existingUser = await prisma.user.findUnique({
                        where: { email: user.email },
                    })

                    if (!existingUser) {
                        await prisma.user.create({
                            data: {
                                email: user.email,
                                name: user.name,
                                image: user.image,
                                themeColor: "#3b82f6",
                            },
                        })
                    }
                } catch (error) {
                    console.error("[Auth] OAuth user creation error:", error)
                    return false
                }
            }
            return true
        },
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
        GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        {
            id: "azure-ad",
            name: "Microsoft",
            type: "oauth",
            issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`,
            authorization: {
                url: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
                params: {
                    scope: "openid profile email",
                },
            },
            token: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
            userinfo: "https://graph.microsoft.com/oidc/userinfo",
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            profile(profile: any) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email || profile.preferred_username || profile.upn,
                    image: profile.picture,
                }
            },
        },
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                console.log("[Auth] Attempting credentials login for:", credentials?.email)

                if (!credentials?.email || !credentials?.password) {
                    console.log("[Auth] Missing credentials")
                    return null
                }

                try {
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email as string },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            password: true,
                            image: true,
                        }
                    })

                    if (!user || !user.password) {
                        console.log("[Auth] User not found or no password")
                        return null
                    }

                    const isValid = await bcrypt.compare(credentials.password as string, user.password)

                    if (!isValid) {
                        console.log("[Auth] Invalid password")
                        return null
                    }

                    console.log("[Auth] Login successful for:", user.email)

                    // Return user without password
                    // Return minimal user data to prevent huge cookies
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        // image: user.image, // Commented out to reduce size if image is base64
                    }
                } catch (error) {
                    console.error("[Auth] Authorization error:", error)
                    return null
                }
            },
        }),
    ],
})
