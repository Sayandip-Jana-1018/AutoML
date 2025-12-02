import { useState, useEffect, useRef } from 'react';

interface UseVoiceRecordingReturn {
    isRecording: boolean;
    transcript: string;
    isSupported: boolean;
    error: string | null;
    startRecording: () => void;
    stopRecording: () => void;
    resetTranscript: () => void;
}

export function useVoiceRecording(): UseVoiceRecordingReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const finalTranscriptRef = useRef('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            if (SpeechRecognition) {
                setIsSupported(true);
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';
                recognitionRef.current.maxAlternatives = 1;

                recognitionRef.current.onresult = (event: any) => {
                    let interimTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcriptPiece = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscriptRef.current += transcriptPiece + ' ';
                        } else {
                            interimTranscript += transcriptPiece;
                        }
                    }

                    setTranscript(finalTranscriptRef.current + interimTranscript);
                };

                recognitionRef.current.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);

                    if (event.error === 'no-speech') {
                        return;
                    }

                    if (event.error === 'aborted') {
                        return;
                    }

                    setError(`Error: ${event.error}`);
                    setIsRecording(false);
                };

                recognitionRef.current.onend = () => {
                    if (isRecording) {
                        try {
                            recognitionRef.current?.start();
                        } catch (e) {
                            setIsRecording(false);
                        }
                    } else {
                        setIsRecording(false);
                    }
                };
            } else {
                setIsSupported(false);
                setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isRecording]);

    const startRecording = () => {
        if (!isSupported || !recognitionRef.current) {
            setError('Speech recognition is not available');
            return;
        }

        try {
            setError(null);
            finalTranscriptRef.current = '';
            setTranscript('');
            recognitionRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Failed to start recording');
        }
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    const resetTranscript = () => {
        setTranscript('');
        finalTranscriptRef.current = '';
        setError(null);
    };

    return {
        isRecording,
        transcript,
        isSupported,
        error,
        startRecording,
        stopRecording,
        resetTranscript
    };
}
