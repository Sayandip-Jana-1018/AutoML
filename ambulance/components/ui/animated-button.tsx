import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'glass';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
    ripple?: boolean;
}

export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
    ({
        children,
        className,
        variant = 'primary',
        size = 'md',
        loading = false,
        icon,
        ripple = true,
        disabled,
        onClick,
        ...props
    }, ref) => {
        const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([]);

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            if (ripple && !disabled && !loading) {
                const button = e.currentTarget;
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const id = Date.now();

                setRipples(prev => [...prev, { x, y, id }]);

                setTimeout(() => {
                    setRipples(prev => prev.filter(r => r.id !== id));
                }, 600);
            }

            if (onClick && !disabled && !loading) {
                onClick(e);
            }
        };

        const variants = {
            primary: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/50',
            secondary: 'bg-gradient-to-r from-gray-600 to-gray-500 hover:from-gray-700 hover:to-gray-600 text-white shadow-lg shadow-gray-500/50',
            danger: 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white shadow-lg shadow-red-500/50',
            success: 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg shadow-green-500/50',
            glass: 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white shadow-lg'
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-base',
            lg: 'px-6 py-3 text-lg'
        };

        return (
            <button
                ref={ref}
                className={cn(
                    'relative overflow-hidden rounded-full font-semibold transition-all duration-300',
                    'transform active:scale-95',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2',
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={disabled || loading}
                onClick={handleClick}
                {...props}
            >
                {/* Ripple Effect */}
                {ripples.map(ripple => (
                    <span
                        key={ripple.id}
                        className="absolute bg-white/30 rounded-full animate-ripple pointer-events-none"
                        style={{
                            left: ripple.x,
                            top: ripple.y,
                            width: 10,
                            height: 10,
                            transform: 'translate(-50%, -50%)'
                        }}
                    />
                ))}

                {/* Loading Spinner */}
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}

                {/* Icon */}
                {!loading && icon && <span>{icon}</span>}

                {/* Children */}
                <span>{children}</span>
            </button>
        );
    }
);

AnimatedButton.displayName = 'AnimatedButton';
