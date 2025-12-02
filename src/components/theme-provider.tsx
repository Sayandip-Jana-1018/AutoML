"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"
import { ThemeColorProvider } from "@/context/theme-context"

import { SessionProvider } from "next-auth/react"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <SessionProvider>
      <NextThemesProvider {...props}>
        <ThemeColorProvider>
          {children}
        </ThemeColorProvider>
      </NextThemesProvider>
    </SessionProvider>
  )
}
