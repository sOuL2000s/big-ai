// hooks/useSpeechRecognition.ts
import { useState, useEffect, useCallback, useRef } from 'react';

// Define the API global object (must be window.SpeechRecognition or window.webkitSpeechRecognition)
declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionAPI;
        webkitSpeechRecognition?: SpeechRecognitionAPI;
    }
}

interface SpeechRecognitionAPI {
    new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: ((event: Event) => void) | null;
    onresult: ((event: Event) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: ((event: Event) => void) | null;
    start(): void;
    stop(): void;
}

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

interface SpeechRecognitionOptions {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
    onFinalTranscript?: (transcript: string) => void;
    onInterimTranscript?: (transcript: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
}

interface SpeechRecognitionResultItem {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
}

interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionResultItem;
    isFinal: boolean;
    length: number;
}

interface SpeechRecognitionEventResult extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

const useSpeechRecognition = (options: SpeechRecognitionOptions = {}) => {
    const {
        continuous = true,
        interimResults = true,
        lang = 'en-US',
        onFinalTranscript,
        onInterimTranscript,
        onStart,
        onEnd,
        onError,
    } = options;

    const recognitionSupported = SpeechRecognition !== null;
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const finalTranscriptRef = useRef('');

    const resetTranscript = useCallback(() => {
        setTranscript('');
        finalTranscriptRef.current = '';
    }, []);

    useEffect(() => {
        if (!recognitionSupported || !SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognition.onstart = () => {
            setIsListening(true);
            finalTranscriptRef.current = '';
            onStart?.();
        };

        recognition.onresult = (event: Event) => {
            const speechEvent = event as SpeechRecognitionEventResult;
            let interim = '';
            let final = '';

            for (let i = speechEvent.resultIndex; i < speechEvent.results.length; ++i) {
                const result = speechEvent.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                finalTranscriptRef.current += final;
                onFinalTranscript?.(finalTranscriptRef.current.trim());
            }
            
            // Update the main transcript state with both final and interim results
            setTranscript((finalTranscriptRef.current + interim).trim());
            onInterimTranscript?.(interim.trim());
        };
        recognition.onerror = (event: Event) => {
            const errorEvent = event as ErrorEvent;
            console.error('Speech recognition error:', event);
            setIsListening(false);
            onError?.(errorEvent.error);
        };

        recognition.onend = () => {
            setIsListening(false);
            // Ensure the final transcript is processed one last time if not already
            if (finalTranscriptRef.current && finalTranscriptRef.current.trim() !== '' && !continuous) {
                onFinalTranscript?.(finalTranscriptRef.current.trim());
            }
            onEnd?.();
        };

        recognitionRef.current = recognition;

        // Cleanup
        return () => {
            recognition.onstart = null;
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
            if (isListening) {
                recognition.stop();
            }
        };
    }, [recognitionSupported, continuous, interimResults, lang, onStart, onEnd, onError, onFinalTranscript, onInterimTranscript]);

    const startListening = useCallback((initialText: string = '') => {
        if (recognitionRef.current && !isListening) {
            // If the user has pre-filled text, treat it as the base
            if (initialText.trim()) {
                 finalTranscriptRef.current = initialText.trim() + ' ';
                 setTranscript(initialText.trim());
            } else {
                 resetTranscript();
            }
            
            try {
                recognitionRef.current.start();
            } catch (e: unknown) {
                // Ignore InvalidStateError if recognition is already running (rare but happens)
                const error = e as Error;
                if (error.name !== 'InvalidStateError') {
                    console.error("Error starting recognition:", e);
                    recognitionRef.current.stop();
                    onError?.(error.message);
                }
            }
        }
    }, [isListening, resetTranscript, onError]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    return {
        isListening,
        transcript,
        startListening,
        stopListening,
        recognitionSupported,
        resetTranscript,
    };
};

export default useSpeechRecognition;