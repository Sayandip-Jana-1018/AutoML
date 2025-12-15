'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2, Play, WrapText, ZoomIn, ZoomOut, Settings2, RefreshCw } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useThemeColor } from '@/context/theme-context';

interface CodeEditorProps {
    code: string;
    onChange: (val: string) => void;
    onSave: () => void;
    onRun?: () => void;
    onSyncVSCode?: () => void;
    saving: boolean;
    running?: boolean;
    syncing?: boolean;
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

export const CodeEditor = ({ code, onChange, onSave, onRun, onSyncVSCode, saving, running, syncing }: CodeEditorProps) => {
    const { themeColor } = useThemeColor();
    const [displayedLines, setDisplayedLines] = useState<string[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [wordWrap, setWordWrap] = useState(false);
    const [fontSize, setFontSize] = useState(13);
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

                {/* Editor Controls */}
                <div className="flex items-center gap-2">
                    {/* Font Size Controls */}
                    <div className="flex items-center gap-1 mr-2">
                        <button
                            onClick={() => setFontSize(s => Math.max(10, s - 1))}
                            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
                            title="Decrease font size"
                        >
                            <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-white/40 w-6 text-center">{fontSize}</span>
                        <button
                            onClick={() => setFontSize(s => Math.min(20, s + 1))}
                            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
                            title="Increase font size"
                        >
                            <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Word Wrap Toggle */}
                    <button
                        onClick={() => setWordWrap(!wordWrap)}
                        className={`p-1.5 rounded transition-colors ${wordWrap ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/50'}`}
                        title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
                    >
                        <WrapText className="w-3.5 h-3.5" />
                    </button>

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
                        title="Save script (Ctrl+S)"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {saving ? 'Syncing...' : 'Save'}
                    </button>

                    {/* VS Code Sync Button */}
                    {onSyncVSCode && (
                        <button
                            onClick={onSyncVSCode}
                            disabled={syncing}
                            className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 hover:brightness-110"
                            style={{
                                backgroundColor: '#3b82f620',
                                color: '#3b82f6',
                                border: '1px solid #3b82f630'
                            }}
                            title="Sync from VS Code"
                        >
                            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {syncing ? 'Syncing...' : 'Sync'}
                        </button>
                    )}

                    {/* Run Training Button */}
                    {onRun && (
                        <button
                            onClick={onRun}
                            disabled={running}
                            className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-50 hover:brightness-110"
                            style={{
                                backgroundColor: running ? '#f59e0b' : '#22c55e',
                                color: 'white'
                            }}
                            title="Run training on VM"
                        >
                            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            {running ? 'Training...' : 'Run'}
                        </button>
                    )}
                </div>
            </div>

            {/* Code Area with Syntax Highlighting - Single theme-colored scrollbar */}
            <style dangerouslySetInnerHTML={{
                __html: `
                #code-editor-scroll::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                #code-editor-scroll::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 4px;
                }
                #code-editor-scroll::-webkit-scrollbar-thumb {
                    background: ${themeColor}40;
                    border-radius: 4px;
                }
                #code-editor-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${themeColor}80;
                }
                #code-editor-scroll::-webkit-scrollbar-corner {
                    background: transparent;
                }
            `}} />
            <div
                id="code-editor-scroll"
                className="flex-1 bg-[#0d0d0d]"
                style={{
                    overflow: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${themeColor}40 rgba(0,0,0,0.2)`,
                }}
            >
                <div className="flex" style={{ minHeight: '100%' }}>
                    {/* Line Numbers - Sticky */}
                    <div
                        className="flex-shrink-0 py-4 px-3 bg-[#0a0a0a] border-r border-white/5 select-none sticky left-0 z-10"
                    >
                        <div className="font-mono text-right" style={{ color: `${themeColor}60`, fontSize: `${fontSize}px`, lineHeight: '1.6' }}>
                            {displayedLines.map((_, i) => (
                                <div key={i} style={{ height: `${fontSize * 1.6}px` }}>{i + 1}</div>
                            ))}
                        </div>
                    </div>

                    {/* Code Content - Relative positioning for proper scroll */}
                    <div className="relative" style={{ minWidth: wordWrap ? '0' : 'fit-content', flex: wordWrap ? 1 : 'none' }}>
                        {/* Syntax Highlighted Display */}
                        <pre
                            className="py-4 px-4 font-mono pointer-events-none"
                            style={{
                                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                                wordBreak: wordWrap ? 'break-word' : 'normal',
                                fontSize: `${fontSize}px`,
                                lineHeight: '1.6',
                                minWidth: wordWrap ? '100%' : 'max-content'
                            }}
                        >
                            {displayedLines.map((line, i) => (
                                <div key={i} style={{ minHeight: `${fontSize * 1.6}px` }}>
                                    {highlightLine(line)}
                                    {isAnimating && i === displayedLines.length - 1 && (
                                        <span className="animate-pulse text-white">▊</span>
                                    )}
                                </div>
                            ))}
                        </pre>

                        {/* Editable Textarea - Positioned on top */}
                        <textarea
                            ref={textareaRef}
                            value={code}
                            onChange={handleTextChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            className="absolute inset-0 py-4 px-4 bg-transparent text-transparent caret-white font-mono resize-none focus:outline-none"
                            spellCheck={false}
                            style={{
                                tabSize: 4,
                                caretColor: themeColor,
                                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                                wordBreak: wordWrap ? 'break-word' : 'normal',
                                fontSize: `${fontSize}px`,
                                lineHeight: '1.6',
                                overflow: 'hidden'  // FIX: Prevent double scrollbar - outer container handles scrolling
                            }}
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
                    <span className="text-white/30">Ctrl+S to save</span>
                </div>
                <div className="flex items-center gap-4">
                    <span>Ln {displayedLines.length}</span>
                    <span>{wordWrap ? 'Wrap: On' : 'Wrap: Off'}</span>
                    <span>Size: {fontSize}px</span>
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
