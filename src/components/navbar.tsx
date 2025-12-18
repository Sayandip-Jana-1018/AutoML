"use client"

import { useState, useEffect } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { motion } from "framer-motion"
import { Sparkles, Home, Grid, User, MessageCircle, Rocket, CreditCard, BarChart3 } from "lucide-react"
import Link from "next/link"
import { useThemeColor } from "@/context/theme-context"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

// Default colors for each page
const PAGE_COLORS: Record<string, string> = {
  "/": "#0cb322",           // Home - Green
  "/studio": "#3B82F6",     // Studio - Blue
  "/visualize": "#8B5CF6",  // Visualize - Purple
  "/marketplace": "#06B6D4", // Marketplace - Cyan
  "/chat": "#E947F5",       // Chat - Pink
  "/deploy": "#6f510b",     // Deploy - Gold
  "/pricing": "#8B5CF6",    // Pricing - Purple
  "/profile": "#F59E0B",    // Profile - Amber
}

export function Navbar() {
  const { themeColor } = useThemeColor()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const pathname = usePathname()

  const navItems = [
    { name: "Home", icon: Home, href: "/", defaultColor: PAGE_COLORS["/"] },
    { name: "Studio", icon: Sparkles, href: "/studio", defaultColor: PAGE_COLORS["/studio"] },
    { name: "Visualize", icon: BarChart3, href: "/visualize", defaultColor: PAGE_COLORS["/visualize"] },
    { name: "Marketplace", icon: Grid, href: "/marketplace", defaultColor: PAGE_COLORS["/marketplace"] },
    { name: "Chat", icon: MessageCircle, href: "/chat", defaultColor: PAGE_COLORS["/chat"] },
    { name: "Deploy", icon: Rocket, href: "/deploy", defaultColor: PAGE_COLORS["/deploy"] },
    { name: "Pricing", icon: CreditCard, href: "/pricing", defaultColor: PAGE_COLORS["/pricing"] },
    { name: "Profile", icon: User, href: "/profile", defaultColor: PAGE_COLORS["/profile"] },
  ]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
    >
      {/* Glass Pill Container */}
      <nav className="relative flex items-center gap-1 p-1.5 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl dark:shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] shadow-black/5 overflow-hidden">

        {navItems.map((item, index) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
          const isHovered = hoveredIndex === index
          const itemColor = item.defaultColor

          return (
            <Link
              key={item.name}
              href={item.href}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                "relative px-2.5 md:px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 group z-10",
                isActive ? "text-foreground font-semibold" : "text-black/60 dark:text-white/60"
              )}
              style={{
                color: (isHovered || isActive) ? itemColor : undefined,
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Active Item Hard Background for Contrast */}
              {isActive && (
                <motion.div
                  layoutId="navbar-active-bg"
                  className="absolute inset-0 rounded-full shadow-[0_0_20px_-10px_rgba(255,255,255,0.3)]"
                  style={{ backgroundColor: `${itemColor}15` }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              {/* Icon - Always colored with page default */}
              <item.icon
                className="w-4 h-4 transition-all duration-300 relative z-10"
                style={{
                  color: itemColor,
                  transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  filter: isHovered ? `drop-shadow(0 0 6px ${itemColor}80)` : 'none',
                  transition: 'all 0.3s ease'
                }}
              />

              <span
                className="text-sm relative z-10 transition-all duration-300 hidden md:inline"
                style={{
                  color: (isHovered || isActive) ? itemColor : undefined
                }}
              >{item.name}</span>
            </Link>
          )
        })}


      </nav>
    </motion.div>
  )
}
