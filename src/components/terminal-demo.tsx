"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useThemeColor } from "@/context/theme-context"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment, ContactShadows } from "@react-three/drei"
import { MacBook, DualMacBook } from "@/components/macbook"
import * as THREE from "three"

// --- Terminal Content ---
function TerminalContent({ themeColor }: { themeColor: string }) {
    const [lines, setLines] = useState<Array<{ text: string; type: 'command' | 'output' | 'success' | 'process'; id: number }>>([])
    const [currentStep, setCurrentStep] = useState(0)

    useEffect(() => {
        let timeout: NodeJS.Timeout
        const steps = [
            { text: "AutoForge ML init --project ml-model", type: 'command', delay: 1000 },
            { text: "Loading 3D assets...", type: 'process', delay: 800 },
            { text: "System ready.", type: 'success', delay: 1000 },
            { text: "Initializing neural engine...", type: 'process', delay: 1200 },
            { text: "Optimizing render pipeline...", type: 'process', delay: 1000 },
            { text: "Done. Ready to build.", type: 'success', delay: 500 },
        ]

        const runSimulation = async () => {
            if (currentStep >= steps.length) return
            const step = steps[currentStep]
            setLines(prev => [...prev, { text: step.text, type: step.type as any, id: Date.now() }])
            timeout = setTimeout(() => setCurrentStep(prev => prev + 1), step.delay)
        }
        runSimulation()
        return () => clearTimeout(timeout)
    }, [currentStep])

    return (
        <div className="w-full h-full bg-[#0f0f12] text-white p-6 font-mono text-xs md:text-sm overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <div className="text-white/30 text-[10px]">user@AutoForge ML: ~</div>
            </div>
            <div className="flex flex-col gap-2">
                {lines.map((line) => (
                    <div key={line.id} className="flex items-start gap-2">
                        {line.type === 'command' && <span className="text-pink-500 shrink-0">➜</span>}
                        <span className={cn(
                            "leading-relaxed",
                            line.type === 'command' && "text-white font-bold",
                            line.type === 'process' && "text-yellow-400",
                            line.type === 'success' && "text-green-400"
                        )}>
                            {line.text}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// --- Complete Animation Flow ---
function Scene({ themeColor }: { themeColor: string }) {
    const dualGroup = useRef<THREE.Group>(null)
    const singleGroup = useRef<THREE.Group>(null)
    const [scrollY, setScrollY] = useState(0)

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useFrame(() => {
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800

        // DUAL MACBOOK ANIMATION (0% - 60% scroll) - Exit RIGHT
        if (dualGroup.current && scrollY < vh * 0.6) {
            const progress = scrollY / (vh * 0.6)
            const eased = progress * progress * (3 - 2 * progress)

            const targetX = THREE.MathUtils.lerp(6.5, 20, eased)
            const targetY = -1.2

            dualGroup.current.position.x = THREE.MathUtils.lerp(dualGroup.current.position.x, targetX, 0.15)
            dualGroup.current.position.y = THREE.MathUtils.lerp(dualGroup.current.position.y, targetY, 0.15)
        }

        // SINGLE MACBOOK ANIMATION (5% scroll onwards) - VERY EARLY ENTRY
        if (singleGroup.current && scrollY >= vh * 0.05) {
            const adjustedScroll = scrollY - vh * 0.05

            // CINEMATIC LID MOVEMENT
            singleGroup.current.traverse((child) => {
                if (child.name === 'Screen') {
                    if (adjustedScroll < vh * 2.0) {
                        const progress = adjustedScroll / (vh * 2.0)
                        const lidAngle = THREE.MathUtils.lerp(Math.PI * 0.4, Math.PI * 0.1, progress)
                        child.rotation.x = lidAngle
                    } else if (adjustedScroll < vh * 3.2) {
                        const progress = (adjustedScroll - vh * 2.0) / (vh * 1.2)
                        const lidAngle = THREE.MathUtils.lerp(Math.PI * 0.1, Math.PI * 0.2, progress)
                        child.rotation.x = lidAngle
                    } else if (adjustedScroll < vh * 4.4) {
                        const progress = (adjustedScroll - vh * 3.2) / (vh * 1.2)
                        const lidAngle = THREE.MathUtils.lerp(Math.PI * 0.2, Math.PI * 0.15, progress)
                        child.rotation.x = lidAngle
                    } else if (adjustedScroll < vh * 5.6) {
                        const progress = (adjustedScroll - vh * 4.4) / (vh * 1.2)
                        const lidAngle = THREE.MathUtils.lerp(Math.PI * 0.15, Math.PI * 0.25, progress)
                        child.rotation.x = lidAngle
                    } else {
                        child.rotation.x = Math.PI * 0.1
                    }
                }
            })

            if (adjustedScroll < vh * 2.0) {
                const progress = adjustedScroll / (vh * 2.0)
                const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

                const targetX = THREE.MathUtils.lerp(-15, 0, eased)
                const targetY = -2.5
                const targetZ = THREE.MathUtils.lerp(0, 1.5, eased)
                const targetRotY = THREE.MathUtils.lerp(0.2, 0, eased)
                const targetRotX = THREE.MathUtils.lerp(0.08, 0.25, eased)
                const targetScale = THREE.MathUtils.lerp(0.16, 0.28, eased)

                singleGroup.current.position.x = THREE.MathUtils.lerp(singleGroup.current.position.x, targetX, 0.15)
                singleGroup.current.position.y = THREE.MathUtils.lerp(singleGroup.current.position.y, targetY, 0.15)
                singleGroup.current.position.z = THREE.MathUtils.lerp(singleGroup.current.position.z, targetZ, 0.15)
                singleGroup.current.rotation.x = THREE.MathUtils.lerp(singleGroup.current.rotation.x, targetRotX, 0.15)
                singleGroup.current.rotation.y = THREE.MathUtils.lerp(singleGroup.current.rotation.y, targetRotY, 0.15)
                singleGroup.current.scale.setScalar(THREE.MathUtils.lerp(singleGroup.current.scale.x, targetScale, 0.15))

            } else if (adjustedScroll < vh * 3.2) {
                const progress = (adjustedScroll - vh * 2.0) / (vh * 1.2)
                const eased = progress * progress * (3 - 2 * progress)

                const targetX = THREE.MathUtils.lerp(0, -3.8, eased)
                const targetY = THREE.MathUtils.lerp(-2.5, -3.0, eased)
                const targetZ = THREE.MathUtils.lerp(1.5, 0.8, eased)
                const targetRotY = THREE.MathUtils.lerp(0, 0.45, eased)
                const targetRotX = THREE.MathUtils.lerp(0.25, 0.15, eased)
                const targetRotZ = THREE.MathUtils.lerp(0, 0.04, eased)
                const targetScale = THREE.MathUtils.lerp(0.28, 0.26, eased)

                singleGroup.current.position.x = THREE.MathUtils.lerp(singleGroup.current.position.x, targetX, 0.15)
                singleGroup.current.position.y = THREE.MathUtils.lerp(singleGroup.current.position.y, targetY, 0.15)
                singleGroup.current.position.z = THREE.MathUtils.lerp(singleGroup.current.position.z, targetZ, 0.15)
                singleGroup.current.rotation.x = THREE.MathUtils.lerp(singleGroup.current.rotation.x, targetRotX, 0.15)
                singleGroup.current.rotation.y = THREE.MathUtils.lerp(singleGroup.current.rotation.y, targetRotY, 0.15)
                singleGroup.current.rotation.z = THREE.MathUtils.lerp(singleGroup.current.rotation.z, targetRotZ, 0.15)
                singleGroup.current.scale.setScalar(THREE.MathUtils.lerp(singleGroup.current.scale.x, targetScale, 0.15))

            } else if (adjustedScroll < vh * 4.4) {
                const progress = (adjustedScroll - vh * 3.2) / (vh * 1.2)
                const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

                const targetX = THREE.MathUtils.lerp(-3.8, 3.5, eased)
                const targetY = THREE.MathUtils.lerp(-3.0, -3.0, eased)
                const targetZ = THREE.MathUtils.lerp(0.8, 0.5, eased)
                const targetRotY = THREE.MathUtils.lerp(0.45, -0.35, eased)
                const targetRotX = THREE.MathUtils.lerp(0.15, 0.12, eased)
                const targetRotZ = THREE.MathUtils.lerp(0.04, 0, eased)
                const targetScale = THREE.MathUtils.lerp(0.26, 0.27, eased)

                singleGroup.current.position.x = THREE.MathUtils.lerp(singleGroup.current.position.x, targetX, 0.15)
                singleGroup.current.position.y = THREE.MathUtils.lerp(singleGroup.current.position.y, targetY, 0.15)
                singleGroup.current.position.z = THREE.MathUtils.lerp(singleGroup.current.position.z, targetZ, 0.15)
                singleGroup.current.rotation.x = THREE.MathUtils.lerp(singleGroup.current.rotation.x, targetRotX, 0.15)
                singleGroup.current.rotation.y = THREE.MathUtils.lerp(singleGroup.current.rotation.y, targetRotY, 0.15)
                singleGroup.current.rotation.z = THREE.MathUtils.lerp(singleGroup.current.rotation.z, targetRotZ, 0.15)
                singleGroup.current.scale.setScalar(THREE.MathUtils.lerp(singleGroup.current.scale.x, targetScale, 0.15))

            } else if (adjustedScroll < vh * 5.6) {
                const progress = (adjustedScroll - vh * 4.4) / (vh * 1.2)
                const eased = progress * progress * (3 - 2 * progress)

                const targetX = THREE.MathUtils.lerp(3.5, -3.8, eased)
                const targetY = THREE.MathUtils.lerp(-3.0, -3.0, eased)
                const targetZ = THREE.MathUtils.lerp(0.5, 0.8, eased)
                const targetRotY = THREE.MathUtils.lerp(-0.35, 0.45, eased)
                const targetRotX = THREE.MathUtils.lerp(0.12, 0.18, eased)
                const targetScale = THREE.MathUtils.lerp(0.27, 0.26, eased)

                singleGroup.current.position.x = THREE.MathUtils.lerp(singleGroup.current.position.x, targetX, 0.15)
                singleGroup.current.position.y = THREE.MathUtils.lerp(singleGroup.current.position.y, targetY, 0.15)
                singleGroup.current.position.z = THREE.MathUtils.lerp(singleGroup.current.position.z, targetZ, 0.15)
                singleGroup.current.rotation.x = THREE.MathUtils.lerp(singleGroup.current.rotation.x, targetRotX, 0.15)
                singleGroup.current.rotation.y = THREE.MathUtils.lerp(singleGroup.current.rotation.y, targetRotY, 0.15)
                singleGroup.current.scale.setScalar(THREE.MathUtils.lerp(singleGroup.current.scale.x, targetScale, 0.15))

            } else if (adjustedScroll < vh * 6.8) {
                // READY TO BUILD SECTION - PUSHED DOWN
                const progress = (adjustedScroll - vh * 5.6) / (vh * 1.2)
                const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

                const targetX = THREE.MathUtils.lerp(-3.8, 0, eased)
                const targetY = THREE.MathUtils.lerp(-3.0, -3.0, eased)
                const targetZ = THREE.MathUtils.lerp(0.8, 1.5, eased)
                const targetRotY = THREE.MathUtils.lerp(0.45, 0, eased)
                const targetRotX = THREE.MathUtils.lerp(0.18, 0.15, eased)
                const targetRotZ = THREE.MathUtils.lerp(0.04, 0, eased)
                const targetScale = THREE.MathUtils.lerp(0.26, 0.3, eased)

                singleGroup.current.position.x = THREE.MathUtils.lerp(singleGroup.current.position.x, targetX, 0.15)
                singleGroup.current.position.y = THREE.MathUtils.lerp(singleGroup.current.position.y, targetY, 0.15)
                singleGroup.current.position.z = THREE.MathUtils.lerp(singleGroup.current.position.z, targetZ, 0.15)
                singleGroup.current.rotation.x = THREE.MathUtils.lerp(singleGroup.current.rotation.x, targetRotX, 0.15)
                singleGroup.current.rotation.y = THREE.MathUtils.lerp(singleGroup.current.rotation.y, targetRotY, 0.15)
                singleGroup.current.rotation.z = THREE.MathUtils.lerp(singleGroup.current.rotation.z, targetRotZ, 0.15)
                singleGroup.current.scale.setScalar(THREE.MathUtils.lerp(singleGroup.current.scale.x, targetScale, 0.15))

            } else {
                const targetX = 0
                const targetY = -3.0
                const targetZ = 1.5
                const targetRotY = 0
                const targetRotX = 0.15
                const targetScale = 0.3

                singleGroup.current.position.x = THREE.MathUtils.lerp(singleGroup.current.position.x, targetX, 0.15)
                singleGroup.current.position.y = THREE.MathUtils.lerp(singleGroup.current.position.y, targetY, 0.15)
                singleGroup.current.position.z = THREE.MathUtils.lerp(singleGroup.current.position.z, targetZ, 0.15)
                singleGroup.current.rotation.x = THREE.MathUtils.lerp(singleGroup.current.rotation.x, targetRotX, 0.15)
                singleGroup.current.rotation.y = THREE.MathUtils.lerp(singleGroup.current.rotation.y, targetRotY, 0.15)
                singleGroup.current.scale.setScalar(THREE.MathUtils.lerp(singleGroup.current.scale.x, targetScale, 0.15))
            }
        }
    })

    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const showDualMacBook = scrollY < vh * 0.6
    const showSingleMacBook = scrollY >= vh * 0.05  // EARLIER ENTRY

    return (
        <>
            {showDualMacBook && (
                <group ref={dualGroup} position={[6.5, -1.2, 0]} rotation={[0.5, -1, 0]} scale={0.16}>
                    <DualMacBook />
                </group>
            )}

            {showSingleMacBook && (
                <group ref={singleGroup} position={[-15, -2.5, 0]} rotation={[0.08, 0.2, 0]} scale={0.16}>
                    <MacBook disableAutoLid={true}>
                        <TerminalContent themeColor={themeColor} />
                    </MacBook>
                </group>
            )}
        </>
    )
}

export default function TerminalDemo() {
    const { themeColor } = useThemeColor()
    const [webglError, setWebglError] = useState(false)

    return (
        <div className="fixed inset-0 z-10 pointer-events-none">
            {webglError ? (
                <div className="flex items-center justify-center h-full text-white/50 text-sm">
                    WebGL not available
                </div>
            ) : (
                <Canvas
                    camera={{ position: [0, 0, 20], fov: 32 }}
                    gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
                    className="bg-transparent"
                    onCreated={({ gl }) => {
                        if (!gl.getContext()) setWebglError(true)
                    }}
                >
                    <pointLight position={[10, 10, 10]} intensity={1.8} />
                    <ambientLight intensity={0.7} />
                    <spotLight position={[0, 10, 0]} intensity={2.5} color={themeColor} distance={25} />

                    <Scene themeColor={themeColor} />

                    <ContactShadows position={[0, -4.5, 0]} opacity={0.5} scale={45} blur={2.5} far={4.5} />
                    <Environment preset="city" />
                </Canvas>
            )}
        </div>
    )
}