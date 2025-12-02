import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnAuth = nextUrl.pathname.startsWith("/auth")

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
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id
            }
            return token
        }
    },
    providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig
