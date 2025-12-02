import "./globals.css"
import type { Metadata } from "next"
import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"

// Use local fonts instead of Google Fonts to avoid network issues
export const metadata: Metadata = {
    title: "Ambulance Tracker",
    description: "Real-time ambulance tracking system",
    generator: 'v0.dev'
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="font-sans">
                <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    )
}