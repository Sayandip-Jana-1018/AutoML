"use client"

import * as React from "react"

type ThemeColor = string

interface SilkConfig {
  speed: number
  scale: number
  noiseIntensity: number
  rotation: number
}

interface ThemeContextType {
  themeColor: ThemeColor
  setThemeColor: (color: ThemeColor) => void
  silkConfig: SilkConfig
  setSilkConfig: (config: SilkConfig) => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

// Helper to convert Hex to HSL
function hexToHSL(hex: string): { h: number, s: number, l: number } {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const cmin = Math.min(r, g, b),
    cmax = Math.max(r, g, b),
    delta = cmax - cmin;
  let h = 0, s = 0, l = 0;

  if (delta === 0) h = 0;
  else if (cmax === r) h = ((g - b) / delta) % 6;
  else if (cmax === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return { h, s, l };
}

export function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const [themeColor, _setThemeColor] = React.useState<ThemeColor>("#D4AF37") // Default Gold

  const setThemeColor = React.useCallback((color: ThemeColor) => {
    // Strip alpha channel if present (e.g. #RRGGBBAA -> #RRGGBB)
    if (color.startsWith('#') && color.length === 9) {
      color = color.substring(0, 7)
    }
    _setThemeColor(color)
  }, [])

  const [silkConfig, setSilkConfig] = React.useState<SilkConfig>({
    speed: 10,
    scale: 1,
    noiseIntensity: 1.5,
    rotation: 0
  })

  // We need to access the current theme to set defaults
  // Since useTheme must be used inside a ThemeProvider, and this component is likely inside it, we can try importing it.
  // However, if ThemeProvider is wrapping this, we need to be careful about hydration.
  // Let's assume ThemeProvider is a parent.

  // Note: We can't easily import useTheme here if this provider wraps the app but is inside the ThemeProvider.
  // Let's check layout.tsx or providers.tsx if possible, but for now, let's try to use a mutation observer or just simple logic if possible.
  // Actually, the best way is to use useTheme from next-themes if available.

  React.useEffect(() => {
    const root = document.documentElement
    const { h, s, l } = hexToHSL(themeColor)

    // Set the primary color
    root.style.setProperty("--primary", `${h} ${s}% ${l}%`)
    root.style.setProperty("--ring", `${h} ${s}% ${l}%`)

    // Calculate foreground color based on lightness
    // If lightness is high (> 60%), use black text. Otherwise use white.
    if (l > 60) {
      root.style.setProperty("--primary-foreground", "0 0% 0%")
    } else {
      root.style.setProperty("--primary-foreground", "0 0% 100%")
    }

  }, [themeColor])

  const value = React.useMemo(() => ({
    themeColor,
    setThemeColor,
    silkConfig,
    setSilkConfig
  }), [themeColor, setThemeColor, silkConfig])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeColor() {
  const context = React.useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useThemeColor must be used within a ThemeColorProvider")
  }
  return context
}

