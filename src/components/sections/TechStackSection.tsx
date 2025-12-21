"use client"

import { motion } from "framer-motion"
import { useThemeColor } from "@/context/theme-context"
import { NavButton } from "@/components/NavButton"
import SpotlightCard from "@/components/ui/SpotlightCard"
import MagicReveal from "@/components/ui/MagicReveal"

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
                <MagicReveal
                    title="Tech Stack"
                    titleClassName="text-5xl md:text-6xl lg:text-7xl font-black mb-6"
                    titleAlign="right"
                    contentDelay={0.6}
                    particleCount={45}
                >
                    <div className="flex justify-end pr-0 lg:pr-8">
                        <div className="grid grid-cols-4 gap-6 lg:gap-8 max-w-lg">
                            {technologies.map((technology, index) => (
                                <motion.div
                                    key={technology.name}
                                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                    viewport={{ once: true, margin: "-50px" }}
                                    transition={{
                                        duration: 0.5,
                                        delay: index * 0.05,
                                        type: "spring",
                                        stiffness: 100,
                                        damping: 15
                                    }}
                                    className="relative group"
                                >
                                    <SpotlightCard
                                        className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center bg-black/40 border-white/10"
                                        spotlightColor={`${themeColor}60`}
                                    >
                                        <div className="w-full h-full p-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                            <img
                                                src={technology.icon}
                                                alt={technology.name}
                                                className="w-full h-full object-contain filter drop-shadow-xl"
                                            />
                                        </div>
                                    </SpotlightCard>

                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50 pointer-events-none">
                                        <span className="text-[10px] font-medium text-foreground/90 bg-background/95 backdrop-blur-md px-2 py-1 rounded-md border border-foreground/20 shadow-xl">
                                            {technology.name}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.8 }}
                        className="flex justify-end pr-0 lg:pr-8 mt-12"
                    >
                        <NavButton href="/marketplace" variant="ghost" size="md" icon="arrow" requiresAuth>
                            Explore Marketplace
                        </NavButton>
                    </motion.div>
                </MagicReveal>
            </div>
        </section>
    )
}
