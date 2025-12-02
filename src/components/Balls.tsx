import React, { Suspense, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Decal,
  Float,
  OrbitControls,
  Preload,
  useTexture,
  Html,
} from "@react-three/drei"
import * as THREE from "three"

const CanvasLoader = () => {
  return (
    <Html center>
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-t-transparent border-white/30 rounded-full animate-spin" />
      </div>
    </Html>
  )
}

const Ball = (props: { imgUrl: string }) => {
  const [decal] = useTexture([props.imgUrl])
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      // Rotate based on mouse position (more subtle)
      meshRef.current.rotation.y = state.pointer.x * Math.PI * 0.3
      meshRef.current.rotation.x = state.pointer.y * Math.PI * 0.15
    }
  })

  return (
    <Float speed={1.75} rotationIntensity={1} floatIntensity={2}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 0, 0.05]} intensity={1} />
      <pointLight position={[0, 0, 2]} intensity={1.5} />
      <mesh ref={meshRef} castShadow receiveShadow scale={2.8}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color='#ffffff'
          polygonOffset
          polygonOffsetFactor={-5}
          flatShading={false}
          metalness={0.3}
          roughness={0.4}
        />
        <Decal
          position={[0, 0, 1]}
          rotation={[0, 0, 0]}
          scale={1.0}
          map={decal}
        />
      </mesh>
    </Float>
  )
}

export const BallCanvas = ({ icon }: { icon: string }) => {
  return (
    <Canvas
      frameloop='demand'
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true }}
    >
      <Suspense fallback={<CanvasLoader />}>
        <OrbitControls enableZoom={false} />
        <Ball imgUrl={icon} />
      </Suspense>

      <Preload all />
    </Canvas>
  )
}

export default BallCanvas
