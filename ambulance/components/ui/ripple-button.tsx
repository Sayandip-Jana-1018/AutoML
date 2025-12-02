"use client";

import React, { useState, useEffect } from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const RippleButton: React.FC<RippleButtonProps> = ({ 
  children, 
  className = "", 
  onClick,
  ...props 
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    
    ripples.forEach((ripple) => {
      const timeout = setTimeout(() => {
        setRipples((prevRipples) =>
          prevRipples.filter((prevRipple) => prevRipple.id !== ripple.id)
        );
      }, 1000);
      
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [ripples]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setRipples([...ripples, { x, y, id: Date.now() }]);

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      {...props}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute animate-ripple rounded-full bg-white/30"
          style={{
            left: ripple.x - 50,
            top: ripple.y - 50,
            width: 100,
            height: 100,
          }}
        />
      ))}
      {children}
    </button>
  );
};
