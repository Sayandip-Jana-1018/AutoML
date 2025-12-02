import React from 'react';
import { cn } from '@/lib/utils';

interface GlassmorphicCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    blur?: 'sm' | 'md' | 'lg' | 'xl';
    opacity?: number;
    borderColor?: string;
    gradient?: boolean;
    hover?: boolean;
}

export const GlassmorphicCard = React.forwardRef<HTMLDivElement, GlassmorphicCardProps>(
    ({
        children,
        className,
        blur = 'md',
        opacity = 0.1,
        borderColor,
        gradient = false,
        hover = true,
        ...props
    }, ref) => {
        const blurValues = {
            sm: 'backdrop-blur-sm',
            md: 'backdrop-blur-md',
            lg: 'backdrop-blur-lg',
            xl: 'backdrop-blur-xl'
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'rounded-2xl border shadow-xl transition-all duration-300',
                    blurValues[blur],
                    hover && 'hover:shadow-2xl hover:scale-[1.01]',
                    gradient && 'bg-gradient-to-br from-white/10 to-white/5 dark:from-white/10 dark:to-white/5',
                    !gradient && 'bg-white/60 dark:bg-white/5',
                    'border-gray-200 dark:border-white/10',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

GlassmorphicCard.displayName = 'GlassmorphicCard';
