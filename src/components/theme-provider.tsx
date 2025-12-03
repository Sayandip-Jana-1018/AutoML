"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"
import { ThemeColorProvider } from "@/context/theme-context"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorProvider>
        {children}
      </ThemeColorProvider>
    </NextThemesProvider>
  )
}
