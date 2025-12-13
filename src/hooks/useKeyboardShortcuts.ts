'use client';

import { useEffect, useCallback } from 'react';

type ShortcutHandler = () => void;

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: ShortcutHandler;
    description?: string;
    enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
    shortcuts: ShortcutConfig[];
    enabled?: boolean;
}

/**
 * useKeyboardShortcuts - A hook for handling keyboard shortcuts
 * 
 * Supports both Cmd (Mac) and Ctrl (Windows) via the `ctrl` flag.
 * 
 * @example
 * useKeyboardShortcuts({
 *   shortcuts: [
 *     { key: 's', ctrl: true, handler: handleSave, description: 'Save script' },
 *     { key: 'Enter', ctrl: true, handler: handleTrain, description: 'Start training' },
 *     { key: 'Escape', handler: closePanel, description: 'Close panel' }
 *   ]
 * });
 */
export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Skip if user is typing in an input/textarea (unless it's Escape)
        const target = event.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        if (isInputField && event.key !== 'Escape') {
            return;
        }

        for (const shortcut of shortcuts) {
            if (shortcut.enabled === false) continue;

            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

            // Handle Cmd (Mac) / Ctrl (Windows) - check both metaKey and ctrlKey
            const ctrlOrCmdPressed = event.metaKey || event.ctrlKey;
            const ctrlMatch = shortcut.ctrl ? ctrlOrCmdPressed : !ctrlOrCmdPressed;

            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                event.stopPropagation();
                shortcut.handler();
                return;
            }
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Get display string for a shortcut (e.g., "⌘S" on Mac, "Ctrl+S" on Windows)
 */
export function getShortcutDisplay(config: Pick<ShortcutConfig, 'key' | 'ctrl' | 'shift' | 'alt'>): string {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
    const parts: string[] = [];

    if (config.ctrl) {
        parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (config.alt) {
        parts.push(isMac ? '⌥' : 'Alt');
    }
    if (config.shift) {
        parts.push(isMac ? '⇧' : 'Shift');
    }

    // Format special keys
    let keyDisplay = config.key;
    if (keyDisplay === 'Enter') keyDisplay = '↵';
    if (keyDisplay === 'Escape') keyDisplay = 'Esc';
    if (keyDisplay === 'ArrowUp') keyDisplay = '↑';
    if (keyDisplay === 'ArrowDown') keyDisplay = '↓';
    if (keyDisplay === 'ArrowLeft') keyDisplay = '←';
    if (keyDisplay === 'ArrowRight') keyDisplay = '→';

    parts.push(keyDisplay.toUpperCase());

    return isMac ? parts.join('') : parts.join('+');
}

/**
 * Common shortcut presets for MLForge
 */
export const COMMON_SHORTCUTS = {
    save: { key: 's', ctrl: true, description: 'Save script' },
    train: { key: 'Enter', ctrl: true, description: 'Start training' },
    closePanel: { key: 'Escape', description: 'Close panel' },
    undo: { key: 'z', ctrl: true, description: 'Undo' },
    redo: { key: 'z', ctrl: true, shift: true, description: 'Redo' },
    find: { key: 'f', ctrl: true, description: 'Find in code' },
    newVersion: { key: 'n', ctrl: true, shift: true, description: 'New version' },
} as const;

export default useKeyboardShortcuts;
