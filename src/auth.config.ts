import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    debug: process.env.NODE_ENV !== "production",
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnAuth = nextUrl.pathname.startsWith("/auth")
            const isOnApi = nextUrl.pathname.startsWith("/api")

            // Allow API routes
            if (isOnApi) {
                return true
            }

            // Allow access to auth pages (login, register, forgot-password)
            if (isOnAuth) {
                if (isLoggedIn) {
                    // If already logged in, redirect to home
                    return Response.redirect(new URL("/", nextUrl))
                }
                return true
            }

            // Require authentication for all other routes (including home /)
            if (!isLoggedIn) {
                return false // Redirects to pages.signIn (/auth/login)
            }

            return true
        },
        async session({ session, token }) {
            if (session.user && token?.sub) {
                session.user.id = token.sub
                session.user.email = token.email as string
                session.user.name = token.name as string
                // Minimal session data
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                return {
                    sub: String(user.id),
                    email: user.email,
                    name: user.name,
                    // Exclude large fields like image if not needed immediately
                }
            }
            return token
        }
    },
    providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig
