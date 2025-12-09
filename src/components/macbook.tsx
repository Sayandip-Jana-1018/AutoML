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
        vid.src = '/macbook1.mp4'
        vid.loop = true
        vid.muted = true
        vid.playsInline = true
        vid.autoplay = true
        // Add error listener
        vid.onerror = (e) => {
            console.warn("Video failed to load:", e)
        }
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
        texture.flipY = true
        return texture
    })

    // Load the GLB model
    const { scene } = useGLTF('/macbook.glb')
    const clone = useMemo(() => scene.clone(), [scene])

    // Store reference to the Screen mesh
    const screenRef = useRef<THREE.Object3D | null>(null)

    // Apply video texture and set initial OPEN state
    useEffect(() => {
        if (!clone || !videoTexture || !videoElement) return

        // Find Screen mesh
        clone.traverse((child) => {
            if (child instanceof THREE.Mesh && child.name === 'Screen') {
                child.material = new THREE.MeshBasicMaterial({
                    map: videoTexture,
                    side: THREE.DoubleSide,
                    toneMapped: false
                })
                child.material.needsUpdate = true
                screenRef.current = child

                // Set initial OPEN state
                child.rotation.x = Math.PI * 0.65
            }
        })

        // Start video playback
        const playVideo = async () => {
            try {
                await videoElement.play()
            } catch (err) {
                console.warn('Autoplay blocked, waiting for interaction')
                const onClick = async () => {
                    try {
                        await videoElement.play()
                    } catch (e) {
                        console.error('Failed to play video:', e)
                    }
                    document.removeEventListener('click', onClick)
                }
                document.addEventListener('click', onClick)
            }
        }

        if (videoElement.readyState >= 2) {
            playVideo()
        } else {
            videoElement.addEventListener('loadeddata', playVideo, { once: true })
        }

        return () => {
            videoElement.pause()
            // Optional: videoTexture.dispose() if we were re-creating it often, 
            // but here it's stable. 
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
        if (typeof document === 'undefined') return null
        const video = document.createElement('video')
        video.src = '/macbook1.mp4'
        video.loop = true
        video.muted = true
        video.playsInline = true
        video.autoplay = true
        video.onerror = (e) => console.warn("DualMacBook video failed:", e)
        return video
    })

    // Create video texture
    const [videoTexture] = useState(() => {
        if (!videoElement) return null
        const texture = new THREE.VideoTexture(videoElement)
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.format = THREE.RGBAFormat
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = true
        return texture
    })

    useEffect(() => {
        if (!group.current || !videoTexture || !videoElement) return

        // Apply video texture to ALL Screen meshes
        group.current.traverse((child) => {
            if (child instanceof THREE.Mesh && child.name.includes('Screen')) {
                child.material = new THREE.MeshBasicMaterial({
                    map: videoTexture,
                    toneMapped: false
                })
            }
        })

        // Play video
        const playVideo = async () => {
            try {
                await videoElement.play()
            } catch (err) {
                console.warn('DualMacBook autoplay blocked')
            }
        }

        if (videoElement.readyState >= 2) {
            playVideo()
        } else {
            videoElement.addEventListener('loadeddata', playVideo, { once: true })
        }

        return () => {
            videoElement.pause()
        }
    }, [videoTexture, videoElement])

    return (
        <group ref={group} {...props} dispose={null}>
            <primitive object={clone} />
        </group>
    )
}

useGLTF.preload('/macbook.glb')
useGLTF.preload('/2macbook.glb')
