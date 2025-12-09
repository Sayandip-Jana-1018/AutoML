"use client";

import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: () => void;
    description: string;
}

interface UseKeyboardShortcutsOptions {
    enabled?: boolean;
    shortcuts: ShortcutConfig[];
}

/**
 * Hook for registering keyboard shortcuts
 * 
 * @example
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: 'Enter', ctrl: true, handler: startTraining, description: 'Start training' },
 *     { key: 'd', ctrl: true, shift: true, handler: toggleDiff, description: 'Toggle diff' },
 *     { key: 'Escape', handler: closeOverlay, description: 'Close overlay' }
 *   ]
 * });
 */
export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsOptions) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Don't trigger shortcuts when typing in inputs
        const target = event.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // Allow Escape to work in inputs
            if (event.key !== 'Escape') return;
        }

        for (const shortcut of shortcuts) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                shortcut.handler();
                return;
            }
        }
    }, [enabled, shortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Get formatted shortcut string for display
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
    const parts: string[] = [];

    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');

    // Capitalize key
    const key = shortcut.key === ' ' ? 'Space' :
        shortcut.key.length === 1 ? shortcut.key.toUpperCase() :
            shortcut.key;
    parts.push(key);

    return parts.join('+');
}

/**
 * Default studio shortcuts
 */
export const STUDIO_SHORTCUTS = {
    START_TRAINING: { key: 'Enter', ctrl: true, description: 'Start training' },
    TOGGLE_DIFF: { key: 'd', ctrl: true, shift: true, description: 'Toggle diff viewer' },
    CLOSE_OVERLAY: { key: 'Escape', description: 'Close overlay/modal' },
    SAVE_DRAFT: { key: 's', ctrl: true, description: 'Save draft' },
    OPEN_TEMPLATES: { key: 't', ctrl: true, shift: true, description: 'Open templates' },
    FOCUS_CHAT: { key: '/', ctrl: true, description: 'Focus chat input' }
};

export default useKeyboardShortcuts;
