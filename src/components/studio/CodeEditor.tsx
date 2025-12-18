'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Loader2, Play, WrapText, ZoomIn, ZoomOut, Settings2, RefreshCw, ChevronUp, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeColor } from '@/context/theme-context';
import { useTheme } from 'next-themes';

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

const SYNTAX_COLORS_LIGHT = {
    keyword: '#D73A49',      // red - def, import, from
    builtin: '#005CC5',      // blue - print, len
    string: '#22863A',       // green - strings
    comment: '#6A737D',      // gray - comments
    function: '#6F42C1',     // purple - function names
    number: '#005CC5',       // blue - numbers
    decorator: '#D73A49',    // red - @decorators
    constant: '#005CC5',     // blue - True, False
    default: '#24292E',      // black - default
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
function highlightLine(line: string, colors: typeof SYNTAX_COLORS): React.ReactNode[] {
    if (!line) return [<span key={0} style={{ color: colors.default }}>{line ?? ''}</span>];

    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining && remaining.length > 0) {
        let matched = false;

        // Comments
        if (remaining.startsWith('#')) {
            tokens.push(<span key={key++} style={{ color: colors.comment }}>{remaining}</span>);
            break;
        }

        // Decorators
        const decoratorMatch = remaining.match(/^@\w+/);
        if (decoratorMatch) {
            tokens.push(<span key={key++} style={{ color: colors.decorator }}>{decoratorMatch[0]}</span>);
            remaining = remaining.slice(decoratorMatch[0].length);
            matched = true;
            continue;
        }

        // Strings (single and double quotes)
        const stringMatch = remaining.match(/^(['"])(.*?)\1/) || remaining.match(/^(['"]).*$/);
        if (stringMatch) {
            tokens.push(<span key={key++} style={{ color: colors.string }}>{stringMatch[0]}</span>);
            remaining = remaining.slice(stringMatch[0].length);
            matched = true;
            continue;
        }

        // Triple quotes
        const tripleMatch = remaining.match(/^('''|""")[\s\S]*?\1/) || remaining.match(/^('''|""").*$/);
        if (tripleMatch) {
            tokens.push(<span key={key++} style={{ color: colors.string }}>{tripleMatch[0]}</span>);
            remaining = remaining.slice(tripleMatch[0].length);
            matched = true;
            continue;
        }

        // Numbers
        const numberMatch = remaining.match(/^\d+\.?\d*/);
        if (numberMatch) {
            tokens.push(<span key={key++} style={{ color: colors.number }}>{numberMatch[0]}</span>);
            remaining = remaining.slice(numberMatch[0].length);
            matched = true;
            continue;
        }

        // Words (keywords, builtins, constants, identifiers)
        const wordMatch = remaining.match(/^[A-Za-z_]\w*/);
        if (wordMatch) {
            const word = wordMatch[0];
            let color = colors.default;

            if (PYTHON_KEYWORDS.includes(word)) {
                color = colors.keyword;
            } else if (PYTHON_BUILTINS.includes(word)) {
                color = colors.builtin;
            } else if (PYTHON_CONSTANTS.includes(word)) {
                color = colors.constant;
            } else if (remaining.slice(word.length).trimStart().startsWith('(')) {
                // Function call
                color = colors.function;
            }

            tokens.push(<span key={key++} style={{ color }}>{word}</span>);
            remaining = remaining.slice(word.length);
            matched = true;
            continue;
        }

        // Single character (operators, punctuation, whitespace)
        if (!matched) {
            tokens.push(<span key={key++} style={{ color: colors.default }}>{remaining[0]}</span>);
            remaining = remaining.slice(1);
        }
    }

    return tokens;
}

export const CodeEditor = ({ code, onChange, onSave, onRun, onSyncVSCode, saving, running, syncing }: CodeEditorProps) => {
    const { themeColor } = useThemeColor();
    const { resolvedTheme } = useTheme();
    const currentColors = resolvedTheme === 'light' ? SYNTAX_COLORS_LIGHT : SYNTAX_COLORS;

    const [displayedLines, setDisplayedLines] = useState<string[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [wordWrap, setWordWrap] = useState(false);
    const [fontSize, setFontSize] = useState(13);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync code to display - immediate update
    useEffect(() => {
        if (!code) {
            setDisplayedLines([]);
            return;
        }

        const lines = code.split('\n');
        setDisplayedLines(lines);
    }, [code]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setIsEditing(true);
        onChange(e.target.value);
        setDisplayedLines(e.target.value.split('\n'));
    };

    const handleFocus = () => setIsEditing(true);
    const handleBlur = () => setIsEditing(false);

    // Mobile collapse state
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Detect mobile
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <motion.div
            className={`flex flex-col overflow-hidden transition-all duration-300 ${isFullscreen ? 'fixed inset-4 z-50' : 'relative'
                }`}
            style={{
                height: isFullscreen ? 'auto' : (isMobile ? (isCollapsed ? '60px' : '300px') : '100%')
            }}
            layout
        >
            {/* Fullscreen overlay backdrop */}
            <AnimatePresence>
                {isFullscreen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-40"
                        onClick={() => setIsFullscreen(false)}
                    />
                )}
            </AnimatePresence>

            <GlassCard className={`flex flex-col overflow-hidden ${isFullscreen ? 'relative z-50 h-full' : 'h-full'
                }`} hover={false}>
                {/* Mac-style Terminal Header */}
                {/* Mac-style Terminal Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/60 dark:bg-[#1a1a1a] border-b border-black/5 dark:border-white/5 backdrop-blur-xl transition-colors duration-300">
                    {/* Traffic Light Buttons */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                            <span className="text-black/40 dark:text-white/40 text-xs font-mono">~</span>
                            <span className="text-black/70 dark:text-white/70 text-xs font-mono">train.py</span>
                            <span className="text-black/30 dark:text-white/30 text-xs">—</span>
                            <span className="text-black/50 dark:text-white/50 text-xs font-mono">python</span>
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

                        {/* Fullscreen Toggle (mobile/tablet) */}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors md:hidden"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen editor'}
                        >
                            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>

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
                    className="flex-1 bg-white/60 dark:bg-[#0d0d0d] backdrop-blur-xl transition-colors duration-300"
                    style={{
                        overflow: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${themeColor}40 rgba(0,0,0,0.2)`,
                    }}
                >
                    <div className="flex" style={{ minHeight: '100%' }}>
                        {/* Line Numbers - Sticky */}
                        <div
                            className="flex-shrink-0 py-4 px-3 bg-transparent border-r border-black/5 dark:border-white/5 select-none sticky left-0 z-10"
                        >
                            <div className="font-mono text-right" style={{ color: resolvedTheme === 'light' ? '#00000080' : `${themeColor}60`, fontSize: `${fontSize}px`, lineHeight: '1.6' }}>
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
                                        {highlightLine(line, currentColors)}
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
                                className="absolute inset-0 py-4 px-4 bg-transparent text-transparent caret-black dark:caret-white font-mono resize-none focus:outline-none"
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
                <div className="flex items-center justify-between px-2 md:px-4 py-1.5 bg-white/60 dark:bg-[#1a1a1a] backdrop-blur-xl border-t border-black/5 dark:border-white/5 text-[10px] text-black/40 dark:text-white/40 transition-colors duration-300">
                    <div className="flex items-center gap-2 md:gap-4">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
                            Python
                        </span>
                        <span className="hidden md:inline">UTF-8</span>
                        <span className="hidden md:inline text-black/30 dark:text-white/30">Ctrl+S to save</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <span>{displayedLines.length}<span className="hidden md:inline"> Lines</span></span>
                        <span className="hidden md:inline">{wordWrap ? 'Wrap: On' : 'Wrap: Off'}</span>
                        <span>{fontSize}<span className="hidden md:inline">px</span></span>
                        <span className="text-green-400">●</span>
                    </div>
                </div>

                {/* Mobile Save button */}
                {isMobile && !isFullscreen && (
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full py-2 flex items-center justify-center gap-2 text-xs text-white font-medium transition-colors"
                        style={{
                            background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                        }}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Code
                            </>
                        )}
                    </button>
                )}
            </GlassCard>
        </motion.div>
    );
};

export default CodeEditor;
