"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface DropdownMenuProps {
    children: React.ReactNode
}

const DropdownMenuContext = React.createContext<{
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
}>({
    isOpen: false,
    setIsOpen: () => { },
})

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
            <div ref={containerRef} className="relative inline-block text-left">
                {children}
            </div>
        </DropdownMenuContext.Provider>
    )
}

export const DropdownMenuTrigger: React.FC<{ asChild?: boolean; children: React.ReactNode }> = ({ asChild, children }) => {
    const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext)

    return (
        <div onClick={() => setIsOpen(!isOpen)}>
            {children}
        </div>
    )
}

export const DropdownMenuContent: React.FC<{
    align?: "start" | "end" | "center"
    className?: string
    children: React.ReactNode
}> = ({ align = "center", className, children }) => {
    const { isOpen } = React.useContext(DropdownMenuContext)

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-md",
                        align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2",
                        className
                    )}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export const DropdownMenuItem: React.FC<{
    className?: string
    onClick?: () => void
    children: React.ReactNode
}> = ({ className, onClick, children }) => {
    const { setIsOpen } = React.useContext(DropdownMenuContext)

    return (
        <div
            className={cn(
                "relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            onClick={(e) => {
                e.stopPropagation()
                onClick?.()
                setIsOpen(false)
            }}
        >
            {children}
        </div>
    )
}
