'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useEmergencyStore } from '@/lib/store';
import { geminiService } from '@/lib/geminiService';
import { useTheme } from 'next-themes';

interface VoiceRecorderProps {
    onSymptomAnalysis?: (analysis: any) => void;
}

export function VoiceRecorder({ onSymptomAnalysis }: VoiceRecorderProps) {
    const { isRecording, transcript, isSupported, error, startRecording, stopRecording, resetTranscript } = useVoiceRecording();
    const { setVoiceTranscript, setIsRecording: setStoreRecording } = useEmergencyStore();
    const { resolvedTheme } = useTheme();
    const [isProcessing, setIsProcessing] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [validationError, setValidationError] = useState<string | null>(null);

    const isDark = resolvedTheme === 'dark';

    useEffect(() => {
        setStoreRecording(isRecording);
        setVoiceTranscript(transcript);
    }, [isRecording, transcript, setStoreRecording, setVoiceTranscript]);

    useEffect(() => {
        if (isRecording) {
            const interval = setInterval(() => {
                setAudioLevel(Math.random() * 100);
            }, 100);
            return () => clearInterval(interval);
        } else {
            setAudioLevel(0);
        }
    }, [isRecording]);

    const handleStartRecording = () => {
        setValidationError(null);
        resetTranscript();
        startRecording();
    };

    const handleStopAndProcess = async () => {
        stopRecording();
        setValidationError(null);
        setIsProcessing(true);

        try {
            console.log('Analyzing symptoms:', transcript);

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Analysis timeout')), 5000)
            );

            // Race between API call and timeout
            const analysis = await Promise.race([
                geminiService.analyzeSymptoms(transcript),
                timeoutPromise
            ]) as any;

            console.log('Analysis result:', analysis);

            // Local keyword check for immediate fallback if API is strict
            const lowerTranscript = transcript.toLowerCase();
            const emergencyKeywords = [
                'heart', 'stroke', 'pain', 'bleeding', 'accident', 'fire', 'emergency', 'help',
                'patient', 'suffering', 'condition', 'sick', 'injured', 'hurt', 'blood', 'burn',
                'breathing', 'conscious', 'unconscious', 'fall', 'fell', 'broken', 'wound',
                'alzheimer', 'dementia', 'attack', 'seizure', 'choking', 'poison', 'overdose'
            ];
            const hasKeyword = emergencyKeywords.some(k => lowerTranscript.includes(k));
            const isLongEnough = transcript.length > 10; // Fallback for any detailed description

            // Check if the input is a valid medical emergency
            // We are now VERY permissive. If it has a keyword OR is long enough, we treat it as valid.
            if (analysis.isMedicalEmergency === false && !hasKeyword && !isLongEnough) {
                const errorMsg = analysis.validationError || 'Please describe a valid medical emergency or symptom.';
                setValidationError(errorMsg);
            } else {
                console.log('Valid medical emergency (API, Keyword, or Length), calling onSymptomAnalysis');

                // Force true if keyword exists or long enough but API said no
                if (analysis.isMedicalEmergency === false) {
                    analysis.isMedicalEmergency = true;
                    analysis.severity = analysis.severity || 'Moderate';
                    analysis.urgency = analysis.urgency || 5;
                    // Ensure we have at least one symptom
                    if (!analysis.symptoms || analysis.symptoms.length === 0) {
                        analysis.symptoms = [transcript];
                    }
                }

                if (onSymptomAnalysis) {
                    onSymptomAnalysis(analysis);
                } else {
                    console.error('onSymptomAnalysis prop is missing!');
                }
            }
        } catch (err) {
            console.error('Error analyzing symptoms:', err);
            // Fallback to basic analysis if service fails completely
            const fallbackAnalysis = {
                symptoms: [transcript],
                severity: 'Moderate',
                urgency: 5,
                requiredSpecializations: ['General'],
                needsBlood: false,
                isMedicalEmergency: true,
                estimatedCondition: 'Condition requires medical attention'
            };
            console.log('Using fallback analysis:', fallbackAnalysis);
            if (onSymptomAnalysis) {
                onSymptomAnalysis(fallbackAnalysis);
            } else {
                console.error('onSymptomAnalysis prop is missing in fallback!');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleQuickDispatch = () => {
        if (transcript.trim()) {
            handleStopAndProcess();
        }
    };

    if (!isSupported) {
        return (
            <div className={`rounded-2xl p-6 backdrop-blur-xl border shadow-xl transition-colors duration-300
                ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white/50 border-slate-200'}
            `}>
                <div className="text-center">
                    <MicOff className="w-12 h-12 mx-auto mb-3 text-red-500" />
                    <p className={`font-medium transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>Voice recording not supported</p>
                    <p className="text-slate-500 text-sm mt-2">Please use Chrome or Edge browser</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className={`rounded-3xl p-6 backdrop-blur-2xl border shadow-2xl space-y-6 relative overflow-hidden group transition-colors duration-300
                ${isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}
            `}>
                {/* Ambient Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-transparent opacity-50 pointer-events-none" />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between">
                    {isRecording && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Recording</span>
                        </div>
                    )}
                </div>

                {/* Microphone Button */}
                <div className="relative z-10 flex justify-center py-4">
                    <button
                        onClick={isRecording ? handleStopAndProcess : handleStartRecording}
                        disabled={isProcessing}
                        className={`
              relative w-28 h-28 rounded-full transition-all duration-500 transform group-hover:scale-105
              ${isRecording
                                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_50px_rgba(239,68,68,0.4)] scale-110'
                                : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:shadow-[0_0_60px_rgba(37,99,235,0.5)]'
                            }
              ${isProcessing ? 'opacity-50 cursor-not-allowed grayscale' : 'active:scale-95'}
              border-4 ${isDark ? 'border-slate-900/50 ring-white/10' : 'border-white/50 ring-slate-200'} ring-1
            `}
                    >
                        {isRecording && (
                            <>
                                <span className="absolute inset-0 rounded-full border border-red-500/50 animate-[ping_1.5s_ease-in-out_infinite]" />
                                <span className="absolute inset-0 rounded-full border border-red-500/30 animate-[ping_2s_ease-in-out_infinite_200ms]" />
                            </>
                        )}

                        <div className="relative z-10 flex items-center justify-center h-full">
                            {isProcessing ? (
                                <Loader2 className="w-12 h-12 text-white/90 animate-spin" />
                            ) : isRecording ? (
                                <MicOff className="w-12 h-12 text-white drop-shadow-lg" />
                            ) : (
                                <Mic className="w-12 h-12 text-white drop-shadow-lg" />
                            )}
                        </div>
                    </button>
                </div>

                {/* Audio Visualizer */}
                {isRecording && (
                    <div className="relative z-10 flex items-center justify-center gap-1.5 h-12 px-4">
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1.5 bg-gradient-to-t from-blue-400 to-cyan-300 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-all duration-75"
                                style={{
                                    height: `${Math.max(15, (audioLevel + Math.random() * 40))}%`,
                                    opacity: 0.6 + Math.random() * 0.4
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Transcript Display - Real-time */}
                {transcript && (
                    <div className={`relative z-10 rounded-2xl p-6 max-h-48 overflow-y-auto border shadow-inner transition-all duration-300
                        ${isDark ? 'bg-slate-900/80 border-slate-800/50 shadow-black/20' : 'bg-white/80 border-slate-200 shadow-slate-200/50'}
                    `}>
                        <p className={`text-xl md:text-2xl leading-relaxed font-semibold tracking-wide transition-colors duration-300 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {transcript}
                            {isRecording && <span className="animate-pulse text-blue-500 ml-1">|</span>}
                        </p>
                    </div>
                )}

                {/* Instructions */}
                {!isRecording && !transcript && (
                    <div className="relative z-10 text-center space-y-2">
                        <p className={`font-medium transition-colors duration-300 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tap to start analysis</p>
                        <p className="text-xs text-slate-500 uppercase tracking-widest">AI Listening Active</p>
                    </div>
                )}

                {/* Error Display */}
                {(error && error !== 'Error: no-speech') || validationError ? (
                    <div className={`relative z-10 border rounded-xl p-3 flex items-center gap-3 transition-colors duration-300
                        ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}
                    `}>
                        <div className={`p-1.5 rounded-full ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-500'}`}>
                            <MicOff size={14} />
                        </div>
                        <p className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                            {validationError || error}
                        </p>
                    </div>
                ) : null}

                {/* Processing Indicator */}
                {isProcessing && (
                    <div className={`relative z-10 flex items-center justify-center gap-3 py-2 rounded-xl border transition-colors duration-300
                        ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-600'}
                    `}>
                        <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                        <span className="text-sm font-bold tracking-wide uppercase">Analyzing Vitals...</span>
                    </div>
                )}
            </div>

            {/* Quick Dispatch Button removed - moved to main controls */}
        </div>
    );
}
