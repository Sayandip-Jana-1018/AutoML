/**
 * Diff Utilities for MLForge
 * 
 * Provides diff generation and application for suggestion code changes.
 * Uses a simple unified diff format for storage efficiency.
 */

import { createPatch, applyPatch } from 'diff';

/**
 * Generate a unified diff between two code strings
 * @param before - Original code
 * @param after - Modified code
 * @param filename - Optional filename for the diff header
 * @returns Unified diff string
 */
export function generateDiff(before: string, after: string, filename = 'script.py'): string {
    return createPatch(filename, before, after, 'original', 'modified');
}

/**
 * Apply a unified diff patch to original code
 * @param original - Original code to patch
 * @param patch - Unified diff patch string
 * @returns Patched code or null if patch failed
 */
export function applyDiffPatch(original: string, patch: string): string | null {
    try {
        const result = applyPatch(original, patch);
        if (result === false) {
            return null; // Patch failed to apply
        }
        return result;
    } catch (error) {
        console.error('[DiffUtils] Failed to apply patch:', error);
        return null;
    }
}

/**
 * Create a simple hash of a string for duplicate detection
 * Uses a fast, non-cryptographic hash suitable for deduplication
 * @param text - Text to hash
 * @returns Hash string
 */
export function hashText(text: string): string {
    // DJB2 hash - fast and good distribution
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash) + text.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex and pad to fixed length
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Get a summary of what changed between two code strings
 * @param before - Original code
 * @param after - Modified code
 * @returns Summary object with counts
 */
export function getDiffSummary(before: string, after: string): {
    linesAdded: number;
    linesRemoved: number;
    linesChanged: number;
} {
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');

    // Simple line-by-line comparison
    let added = 0;
    let removed = 0;
    let changed = 0;

    const minLen = Math.min(beforeLines.length, afterLines.length);

    for (let i = 0; i < minLen; i++) {
        if (beforeLines[i] !== afterLines[i]) {
            changed++;
        }
    }

    if (afterLines.length > beforeLines.length) {
        added = afterLines.length - beforeLines.length;
    } else if (beforeLines.length > afterLines.length) {
        removed = beforeLines.length - afterLines.length;
    }

    return { linesAdded: added, linesRemoved: removed, linesChanged: changed };
}

/**
 * Check if two code strings are semantically similar (ignoring whitespace)
 * @param code1 - First code string
 * @param code2 - Second code string
 * @returns true if semantically similar
 */
export function areCodesSimilar(code1: string, code2: string): boolean {
    // Normalize: remove extra whitespace, lowercase
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    return normalize(code1) === normalize(code2);
}
