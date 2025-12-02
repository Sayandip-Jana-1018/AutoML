"use client"

import { useState, useEffect } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { motion } from "framer-motion"
import { Sparkles, Home, Book, Grid, User, MessageCircle, Rocket, CreditCard } from "lucide-react"
import Link from "next/link"
import { useThemeColor } from "@/context/theme-context"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

export function Navbar() {
  const { themeColor } = useThemeColor()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const pathname = usePathname()

  const navItems = [
    { name: "Home", icon: Home, href: "/" },
    { name: "Studio", icon: Sparkles, href: "/studio" },
    { name: "Marketplace", icon: Grid, href: "/marketplace" },
    { name: "Chat", icon: MessageCircle, href: "/chat" },
    { name: "Deploy", icon: Rocket, href: "/deploy" },
    { name: "Pricing", icon: CreditCard, href: "/pricing" },
    { name: "Profile", icon: User, href: "/profile" },
  ]

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
    >
      {/* Glass Pill Container */}
      <nav className="relative flex items-center gap-1 p-1.5 rounded-full bg-black/20 dark:bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl dark:shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] shadow-black/5 overflow-hidden">

        {navItems.map((item, index) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                "relative px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 group z-10",
                isActive ? "text-foreground font-semibold" : "text-muted-foreground"
              )}
              style={{
                color: (hoveredIndex === index || isActive) ? themeColor : undefined
              }}
            >
              {/* Active Item Hard Background for Contrast */}
              {isActive && (
                <motion.div
                  layoutId="navbar-active-bg"
                  className="absolute inset-0 rounded-full bg-white/10 dark:bg-white/5 shadow-[0_0_20px_-10px_rgba(255,255,255,0.3)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              {/* Icon */}
              <item.icon
                className="w-4 h-4 transition-all duration-300 group-hover:scale-110 relative z-10"
                style={{
                  color: hoveredIndex === index ? themeColor : undefined
                }}
              />

              <span className="text-sm relative z-10">{item.name}</span>
            </Link>
          )
        })}

      </nav>
    </motion.div>
  )
}
