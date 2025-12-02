import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MacBook({ children, ...props }: any) {
    const group = useRef<THREE.Group>(null)

    // Create video element
    const [videoElement] = useState(() => {
        if (typeof document === 'undefined') return null
        const vid = document.createElement('video')
        vid.src = '/doctor.mp4'
        vid.crossOrigin = 'anonymous'
        vid.loop = true
        vid.muted = true
        vid.playsInline = true
        vid.autoplay = true
        return vid
    })

    // Create video texture
    const [videoTexture] = useState(() => {
        if (!videoElement) return null
        const texture = new THREE.VideoTexture(videoElement)
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.format = THREE.RGBAFormat
        texture.colorSpace = THREE.SRGBColorSpace
        texture.generateMipmaps = false
        texture.flipY = true  // Fixed: flip video right-side up
        return texture
    })

    // Load the GLB model
    const { scene } = useGLTF('/macbook.glb')
    const clone = useMemo(() => scene.clone(), [scene])

    // Store reference to the Screen mesh (which is now the parent of the entire lid)
    const screenRef = useRef<THREE.Object3D | null>(null)

    // Apply video texture and set initial OPEN state
    useEffect(() => {
        if (!clone || !videoTexture || !videoElement) return

        // Find Screen mesh (which is the parent of the lid assembly)
        clone.traverse((child) => {
            if (child instanceof THREE.Mesh && child.name === 'Screen') {
                console.log('✅ Found Screen mesh, applying video texture')

                // Apply video texture to the screen
                child.material = new THREE.MeshBasicMaterial({
                    map: videoTexture,
                    side: THREE.DoubleSide,
                    toneMapped: false
                })

                child.material.needsUpdate = true

                // Store reference to Screen (which now has the lid as children)
                screenRef.current = child

                // Set initial OPEN state (lid fully open showing screen)
                // Start at 117° = fully open with screen visible
                child.rotation.x = Math.PI * 0.65
                console.log('🔓 Set MacBook to OPEN state (117°)')
            }
        })

        // Start video playback immediately and keep it playing
        const playVideo = async () => {
            try {
                await videoElement.play()
                console.log('✅ Video playing')
            } catch (err) {
                console.log('⚠️ Autoplay blocked, will play on user interaction')
                const onClick = async () => {
                    try {
                        await videoElement.play()
                        console.log('✅ Video playing after click')
                    } catch (e) {
                        console.error('❌ Failed to play:', e)
                    }
                    document.removeEventListener('click', onClick)
                }
                document.addEventListener('click', onClick)
            }
        }

        // Try to play immediately
        if (videoElement.readyState >= 2) {
            playVideo()
        } else {
            videoElement.addEventListener('loadeddata', playVideo, { once: true })
        }

        return () => {
            videoElement.pause()
        }
    }, [clone, videoTexture, videoElement])

    // Update texture and handle scroll-based lid rotation (REVERSED)
    useFrame(() => {
        // Update video texture every frame (video always plays)
        if (videoTexture && videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            videoTexture.needsUpdate = true
        }

        // Animate lid rotation based on scroll (REVERSED - starts open, closes on scroll)
        // Only if disableAutoLid is not set
        if (screenRef.current && typeof window !== 'undefined' && !props.disableAutoLid) {
            const maxScroll = document.body.scrollHeight - window.innerHeight || 1
            const scrollProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll))

            // Define rotation states (REVERSED)
            const open = Math.PI * 0.65              // Open (117°) - screen visible
            const closed = 0                          // Closed (0°) - lid down on keyboard

            // Use smoothstep for smooth interpolation
            const t = scrollProgress
            const smooth = t * t * (3 - 2 * t)

            // REVERSED: Interpolate from open to closed as scroll increases
            screenRef.current.rotation.x = open * (1 - smooth) + closed * smooth
        }
    })

    return (
        <group ref={group} {...props} dispose={null}>
            <primitive object={clone} />
        </group>
    )
}

// Component for dual MacBooks (initial hero view) with video
export function DualMacBook({ children, ...props }: any) {
    const { scene } = useGLTF('/2macbook.glb')
    const clone = useMemo(() => scene.clone(), [scene])
    const group = useRef<THREE.Group>(null)

    // Create video element
    const [videoElement] = useState(() => {
        const video = document.createElement('video')
        video.src = '/doctor.mp4'
        video.loop = true
        video.muted = true
        video.playsInline = true
        video.play().catch(console.error)
        return video
    })

    // Create video texture
    const [videoTexture] = useState(() => {
        if (!videoElement) return null
        const texture = new THREE.VideoTexture(videoElement)
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.format = THREE.RGBAFormat
        texture.colorSpace = THREE.SRGBColorSpace  // FIX: Proper color space
        texture.flipY = true
        return texture
    })

    useEffect(() => {
        if (!group.current || !videoTexture) return

        // Apply video texture to ALL Screen meshes (Screen, Screen.001, etc.)
        group.current.traverse((child) => {
            if (child instanceof THREE.Mesh && child.name.includes('Screen')) {
                console.log('Applying video to:', child.name)  // Debug log
                child.material = new THREE.MeshBasicMaterial({
                    map: videoTexture,
                    // FIX: Remove toneMapped to preserve video colors
                })
            }
        })
    }, [videoTexture])

    return (
        <group ref={group} {...props} dispose={null}>
            <primitive object={clone} />
        </group>
    )
}

useGLTF.preload('/macbook.glb')
useGLTF.preload('/2macbook.glb')
