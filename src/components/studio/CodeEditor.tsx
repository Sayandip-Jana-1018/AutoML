'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useThemeColor } from '@/context/theme-context';

interface CodeEditorProps {
    code: string;
    onChange: (val: string) => void;
    onSave: () => void;
    saving: boolean;
}

// Python syntax highlighting colors (Jupyter style)
const SYNTAX_COLORS = {
    keyword: '#FF79C6',      // pink - def, import, from, if, for, etc.
    builtin: '#8BE9FD',      // cyan - print, len, range, etc.
    string: '#F1FA8C',       // yellow - strings
    comment: '#6272A4',      // gray-purple - comments
    function: '#50FA7B',     // green - function names
    number: '#BD93F9',       // purple - numbers
    decorator: '#FFB86C',    // orange - @decorators
    constant: '#FF5555',     // red - True, False, None
    default: '#F8F8F2',      // white - default
};

const PYTHON_KEYWORDS = [
    'def', 'class', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while',
    'try', 'except', 'finally', 'with', 'return', 'yield', 'raise', 'pass', 'break',
    'continue', 'and', 'or', 'not', 'in', 'is', 'lambda', 'global', 'nonlocal', 'assert'
];

const PYTHON_BUILTINS = [
    'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
    'open', 'type', 'isinstance', 'enumerate', 'zip', 'map', 'filter', 'sorted',
    'sum', 'min', 'max', 'abs', 'round', 'input', 'format', 'super', 'property'
];

const PYTHON_CONSTANTS = ['True', 'False', 'None'];

// Syntax highlighter function
function highlightLine(line: string): React.ReactNode[] {
    if (!line) return [<span key={0} style={{ color: SYNTAX_COLORS.default }}>{line ?? ''}</span>];

    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining && remaining.length > 0) {
        let matched = false;

        // Comments
        if (remaining.startsWith('#')) {
            tokens.push(<span key={key++} style={{ color: SYNTAX_COLORS.comment }}>{remaining}</span>);
            break;
        }

        // Decorators
        const decoratorMatch = remaining.match(/^@\w+/);
        if (decoratorMatch) {
            tokens.push(<span key={key++} style={{ color: SYNTAX_COLORS.decorator }}>{decoratorMatch[0]}</span>);
            remaining = remaining.slice(decoratorMatch[0].length);
            matched = true;
            continue;
        }

        // Strings (single and double quotes)
        const stringMatch = remaining.match(/^(['"])(.*?)\1/) || remaining.match(/^(['"]).*$/);
        if (stringMatch) {
            tokens.push(<span key={key++} style={{ color: SYNTAX_COLORS.string }}>{stringMatch[0]}</span>);
            remaining = remaining.slice(stringMatch[0].length);
            matched = true;
            continue;
        }

        // Triple quotes
        const tripleMatch = remaining.match(/^('''|""")[\s\S]*?\1/) || remaining.match(/^('''|""").*$/);
        if (tripleMatch) {
            tokens.push(<span key={key++} style={{ color: SYNTAX_COLORS.string }}>{tripleMatch[0]}</span>);
            remaining = remaining.slice(tripleMatch[0].length);
            matched = true;
            continue;
        }

        // Numbers
        const numberMatch = remaining.match(/^\d+\.?\d*/);
        if (numberMatch) {
            tokens.push(<span key={key++} style={{ color: SYNTAX_COLORS.number }}>{numberMatch[0]}</span>);
            remaining = remaining.slice(numberMatch[0].length);
            matched = true;
            continue;
        }

        // Words (keywords, builtins, constants, identifiers)
        const wordMatch = remaining.match(/^[A-Za-z_]\w*/);
        if (wordMatch) {
            const word = wordMatch[0];
            let color = SYNTAX_COLORS.default;

            if (PYTHON_KEYWORDS.includes(word)) {
                color = SYNTAX_COLORS.keyword;
            } else if (PYTHON_BUILTINS.includes(word)) {
                color = SYNTAX_COLORS.builtin;
            } else if (PYTHON_CONSTANTS.includes(word)) {
                color = SYNTAX_COLORS.constant;
            } else if (remaining.slice(word.length).trimStart().startsWith('(')) {
                // Function call
                color = SYNTAX_COLORS.function;
            }

            tokens.push(<span key={key++} style={{ color }}>{word}</span>);
            remaining = remaining.slice(word.length);
            matched = true;
            continue;
        }

        // Single character (operators, punctuation, whitespace)
        if (!matched) {
            tokens.push(<span key={key++} style={{ color: SYNTAX_COLORS.default }}>{remaining[0]}</span>);
            remaining = remaining.slice(1);
        }
    }

    return tokens;
}

export const CodeEditor = ({ code, onChange, onSave, saving }: CodeEditorProps) => {
    const { themeColor } = useThemeColor();
    const [displayedLines, setDisplayedLines] = useState<string[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const lastCodeLengthRef = useRef<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const animationRef = useRef<NodeJS.Timeout | null>(null);

    // Sync code to display - with optional animation
    useEffect(() => {
        if (!code) {
            setDisplayedLines([]);
            lastCodeLengthRef.current = 0;
            return;
        }

        const lines = code.split('\n');
        const lengthDiff = code.length - lastCodeLengthRef.current;

        // Animate if: not editing, new code is much longer (e.g. from AutoML/AI)
        if (!isEditing && lengthDiff > 100 && lines.length > 5) {
            // Clear any existing animation
            if (animationRef.current) clearInterval(animationRef.current);

            setIsAnimating(true);
            setDisplayedLines([]);
            let idx = 0;

            animationRef.current = setInterval(() => {
                if (idx < lines.length) {
                    setDisplayedLines(prev => [...prev, lines[idx]]);
                    idx++;
                } else {
                    if (animationRef.current) clearInterval(animationRef.current);
                    setIsAnimating(false);
                }
            }, 20); // 20ms per line = fast typing

            lastCodeLengthRef.current = code.length;
            return () => {
                if (animationRef.current) clearInterval(animationRef.current);
            };
        } else {
            // Immediate update (small changes or user editing)
            setDisplayedLines(lines);
            lastCodeLengthRef.current = code.length;
            setIsAnimating(false);
        }
    }, [code, isEditing]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setIsEditing(true);
        onChange(e.target.value);
        setDisplayedLines(e.target.value.split('\n'));
        lastCodeLengthRef.current = e.target.value.length;
    };

    const handleFocus = () => setIsEditing(true);
    const handleBlur = () => setIsEditing(false);

    return (
        <GlassCard className="flex flex-col h-full overflow-hidden" hover={false}>
            {/* Mac-style Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a1a] border-b border-white/5">
                {/* Traffic Light Buttons */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                        <span className="text-white/40 text-xs font-mono">~</span>
                        <span className="text-white/70 text-xs font-mono">train.py</span>
                        <span className="text-white/30 text-xs">—</span>
                        <span className="text-white/50 text-xs font-mono">python</span>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 hover:brightness-110"
                    style={{
                        backgroundColor: `${themeColor}20`,
                        color: themeColor,
                        border: `1px solid ${themeColor}30`
                    }}
                >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {saving ? 'Syncing...' : 'Save'}
                </button>
            </div>

            {/* Code Area with Syntax Highlighting - SINGLE SCROLLABLE CONTAINER */}
            <div className="flex-1 overflow-y-auto bg-[#0d0d0d]">
                <div className="flex min-h-full">
                    {/* Line Numbers */}
                    <div className="flex-shrink-0 py-4 px-3 bg-[#0a0a0a] border-r border-white/5 select-none sticky left-0">
                        <div className="font-mono text-xs leading-6 text-right" style={{ color: `${themeColor}60` }}>
                            {displayedLines.map((_, i) => (
                                <div key={i} className="h-6">{i + 1}</div>
                            ))}
                        </div>
                    </div>

                    {/* Code Content - Editable */}
                    <div className="flex-1 relative">
                        {/* Syntax Highlighted Display (read-only overlay) */}
                        <pre className="absolute inset-0 py-4 px-4 font-mono text-sm leading-6 whitespace-pre-wrap pointer-events-none">
                            {displayedLines.map((line, i) => (
                                <div key={i} className="h-6">
                                    {highlightLine(line)}
                                    {isAnimating && i === displayedLines.length - 1 && (
                                        <span className="animate-pulse text-white">▊</span>
                                    )}
                                </div>
                            ))}
                        </pre>

                        {/* Editable Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={code}
                            onChange={handleTextChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className="w-full min-h-full overflow-hidden bg-transparent text-transparent caret-white py-4 px-4 font-mono text-sm resize-none focus:outline-none leading-6"
                            spellCheck={false}
                            style={{ tabSize: 4, caretColor: themeColor }}
                        />
                    </div>
                </div>
            </div>

            {/* Footer Status Bar */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#1a1a1a] border-t border-white/5 text-[10px] text-white/40">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
                        Python
                    </span>
                    <span>UTF-8</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>Ln {displayedLines.length}</span>
                    {isAnimating && (
                        <span className="text-yellow-400 animate-pulse">● Generating...</span>
                    )}
                    {!isAnimating && (
                        <span className="text-green-400">● Ready</span>
                    )}
                </div>
            </div>
        </GlassCard>
    );
};

export default CodeEditor;
