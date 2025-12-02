import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma



export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
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
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                console.log("[Auth] Attempting credentials login for:", credentials?.email)

                if (!credentials?.email || !credentials?.password) {
                    console.log("[Auth] Missing credentials")
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                })

                if (!user) {
                    console.log("[Auth] User not found")
                    return null
                }

                if (!user.password) {
                    console.log("[Auth] User has no password (likely OAuth)")
                    return null
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                )

                if (!isPasswordValid) {
                    console.log("[Auth] Invalid password")
                    return null
                }

                console.log("[Auth] Login successful for:", user.email)
                return user
            },
        }),
    ],
})
