"use client";

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface AmbulanceModelProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

export function AmbulanceModel({ position, rotation = [0, 0, 0] }: AmbulanceModelProps) {
  const modelRef = useRef<THREE.Group>();
  const { scene } = useGLTF('/ambulance_car_-_low_poly.glb');

  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.scale.set(0.0002, 0.0002, 0.0002); // Adjust scale as needed
    }
  }, []);

  useFrame(() => {
    if (modelRef.current) {
      modelRef.current.position.set(...position);
      modelRef.current.rotation.set(...rotation);
    }
  });

  return <primitive ref={modelRef} object={scene} />;
}

// Pre-load the model
useGLTF.preload('/ambulance_car_-_low_poly.glb');
