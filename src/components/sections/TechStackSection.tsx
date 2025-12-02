"use client"

import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"

const technologies = [
    { name: "HTML", icon: "/tech/html.png" },
    { name: "CSS", icon: "/tech/css.png" },
    { name: "Python", icon: "/tech/python.png" },
    { name: "TensorFlow", icon: "/tech/tensorflow.png" },
    { name: "PyTorch", icon: "/tech/pytorch.png" },
    { name: "React", icon: "/tech/react.png" },
    { name: "Next.js", icon: "/tech/nextjs.png" },
    { name: "TypeScript", icon: "/tech/typescript.png" },
    { name: "Tailwind", icon: "/tech/tailwind.png" },
    { name: "Docker", icon: "/tech/docker.png" },
    { name: "Git", icon: "/tech/git.png" },
    { name: "AWS", icon: "/tech/aws.png" },
    { name: "Google Cloud", icon: "/tech/gcp.png" },
    { name: "MongoDB", icon: "/tech/mongodb.png" },
    { name: "Three.js", icon: "/tech/threejs.png" },
    { name: "Node.js", icon: "/tech/nodejs.png" },
]

export function TechStackSection() {
    const { themeColor } = useThemeColor()

    return (
        <section className="relative z-20 min-h-screen flex items-center px-6 md:px-12 lg:px-16 xl:px-20">
            <div className="max-w-5xl w-full ml-auto pr-0 lg:pr-12">
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="space-y-12"
                >
                    <h2 className="text-5xl w-[50%] ml-[455px] md:text-6xl lg:text-7xl font-black mb-6 text-center">
                        <span
                            className="bg-clip-text text-transparent"
                            style={{
                                backgroundImage: `linear-gradient(135deg, ${themeColor}, #fff)`
                            }}
                        >
                            Tech Stack
                        </span>
                    </h2>

                    <div className="flex justify-end pr-0 lg:pr-8">
                        <div className="grid grid-cols-4 gap-6 lg:gap-8 max-w-lg">
                            {technologies.map((technology, index) => (
                                <motion.div
                                    key={technology.name}
                                    initial={{ opacity: 0, scale: 0 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{
                                        duration: 0.5,
                                        delay: 0.6 + index * 0.04,
                                        type: "spring",
                                        stiffness: 120
                                    }}
                                    className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 relative group"
                                >
                                    <div
                                        className="absolute inset-0 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `radial-gradient(circle, ${themeColor}30, transparent 70%)`
                                        }}
                                    />
                                    {/* CSS-based 3D icon */}
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 flex items-center justify-center p-3 transition-transform duration-300 hover:scale-110"
                                        style={{
                                            boxShadow: `0 8px 32px ${themeColor}20, inset 0 0 20px rgba(255,255,255,0.1)`
                                        }}
                                    >
                                        <img
                                            src={technology.icon}
                                            alt={technology.name}
                                            className="w-full h-full object-contain filter drop-shadow-lg"
                                        />
                                    </div>
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50 pointer-events-none">
                                        <span className="text-[10px] font-medium text-foreground/90 bg-background/95 backdrop-blur-md px-2 py-1 rounded-md border border-foreground/20 shadow-xl">
                                            {technology.name}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
