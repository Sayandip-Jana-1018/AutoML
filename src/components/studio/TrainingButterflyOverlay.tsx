'use client';

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

interface ButterflyProps {
    position: [number, number, number];
    scale: number;
    speed: number;
    offset: number;
}

function Butterfly({ position, scale, speed, offset }: ButterflyProps) {
    const ref = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/butterfly.glb');

    useFrame((state) => {
        if (ref.current) {
            const time = state.clock.elapsedTime * speed + offset;
            // Floating motion
            ref.current.position.y = position[1] + Math.sin(time) * 0.5;
            ref.current.position.x = position[0] + Math.cos(time * 0.7) * 2;
            ref.current.position.z = position[2] + Math.sin(time * 0.5) * 1;
            // Gentle rotation
            ref.current.rotation.y = Math.sin(time * 0.3) * 0.5;
            ref.current.rotation.z = Math.sin(time * 2) * 0.1; // Wing flap effect
        }
    });

    return (
        <group ref={ref} position={position} scale={[scale, scale, scale]}>
            <primitive object={scene.clone()} />
        </group>
    );
}

interface TrainingButterflyOverlayProps {
    isVisible: boolean;
    themeColor: string;
    onClose?: () => void;
}

export function TrainingButterflyOverlay({ isVisible, themeColor }: TrainingButterflyOverlayProps) {
    // Generate random butterfly positions
    const butterflies = React.useMemo(() => {
        return Array.from({ length: 8 }, (_, i) => ({
            id: i,
            position: [
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 4
            ] as [number, number, number],
            scale: 0.1 + Math.random() * 0.1, // Smaller butterflies (0.1-0.2)
            speed: 0.5 + Math.random() * 0.5,
            offset: Math.random() * Math.PI * 2
        }));
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-[150] pointer-events-none"
                    style={{ background: 'transparent' }}
                >
                    {/* 3D Canvas with butterflies - status bar now in StudioHeader */}
                    <Canvas
                        camera={{ position: [0, 0, 8], fov: 50 }}
                        style={{ background: 'transparent' }}
                    >
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[10, 10, 5]} intensity={1} />
                        <pointLight position={[-10, -10, -5]} intensity={0.5} color={themeColor} />

                        <Suspense fallback={null}>
                            {butterflies.map((butterfly) => (
                                <Butterfly
                                    key={butterfly.id}
                                    position={butterfly.position}
                                    scale={butterfly.scale}
                                    speed={butterfly.speed}
                                    offset={butterfly.offset}
                                />
                            ))}
                        </Suspense>
                    </Canvas>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Preload the butterfly model
useGLTF.preload('/butterfly.glb');

export default TrainingButterflyOverlay;
