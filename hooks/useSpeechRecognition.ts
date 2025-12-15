// hooks/useSpeechRecognition.ts
import { useState, useEffect, useCallback, useRef } from 'react';

// Define the API global object
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
    onerror: ((event: SpeechRecognitionErrorEventResult) => void) | null; 
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

// Correct interface for the error event
interface SpeechRecognitionErrorEventResult extends Event {
    error: string;
    message: string;
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
    // NEW: Track if the stop was initiated by the user/code
    const isManualStopRef = useRef(false); 

    const resetTranscript = useCallback(() => {
        setTranscript('');
        finalTranscriptRef.current = '';
    }, []);

    const startSession = useCallback(() => {
         if (recognitionRef.current) {
             try {
                 recognitionRef.current.start();
             } catch (error: unknown) { 
                 const e = error as Error;
                 if (e.name !== 'InvalidStateError') {
                     console.error("STT: Fatal Error starting recognition:", e.message);
                     onError?.(e.message);
                 }
             }
         }
    }, [onError]);

    useEffect(() => {
        if (!recognitionSupported || !SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognitionRef.current = recognition;

        recognition.onstart = () => {
            setIsListening(true);
            isManualStopRef.current = false;
            // finalTranscriptRef.current is managed in startListening, don't reset here
            onStart?.();
            console.log('STT: Recognition started.');
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
            }
            
            const currentTotalTranscript = (finalTranscriptRef.current + interim).trim();
            setTranscript(currentTotalTranscript);
            onInterimTranscript?.(interim.trim());
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventResult) => {
            console.error('STT Error:', event.error);
            
            // Critical: If the error is 'network' or 'aborted' it often means the browser timed out 
            // and we should still try to restart if running in continuous mode and not manually stopped.
            if (event.error === 'network' || event.error === 'aborted') {
                // Ignore the error if we are supposed to be continuous, let onend handle the restart
                return;
            }
            
            // Other fatal errors (e.g., 'not-allowed')
            setIsListening(false);
            isManualStopRef.current = true; // Prevents accidental restart
            onError?.(event.error); 
            onEnd?.();
        };

        recognition.onend = () => {
            console.log('STT: Recognition ended (browser event).');

            if (!isManualStopRef.current) {
                // If it was an unintentional stop (timeout, silence, browser limit)
                
                // 1. Process the final piece of speech, if any
                if (finalTranscriptRef.current) {
                    onFinalTranscript?.(finalTranscriptRef.current.trim());
                }

                if (continuous) {
                    // 2. IMMEDIATE RESTART LOOP for continuous mode
                    console.log('STT: Restarting continuous session.');
                    startSession();
                    return; // Skip the state reset below
                }
            } else {
                // If it was a manual stop, finalize the transcript
                if (finalTranscriptRef.current) {
                    onFinalTranscript?.(finalTranscriptRef.current.trim());
                }
            }

            // Standard cleanup if session is truly stopped
            setIsListening(false);
            isManualStopRef.current = false;
            onEnd?.();
        };

        // Cleanup function for useEffect
        return () => {
            if (recognitionRef.current) {
                console.log('STT: Component unmounting/re-rendering, forcing stop.');
                try {
                    isManualStopRef.current = true; // Mark as manual stop during cleanup
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore benign errors during cleanup
                }
            }
            if (recognitionRef.current) {
                recognitionRef.current.onstart = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
            }
        };
    }, [recognitionSupported, continuous, interimResults, lang, onStart, onError, onEnd, onFinalTranscript, onInterimTranscript, startSession]);


    const startListening = useCallback((initialText: string = '') => {
        if (recognitionRef.current && !isListening) {
            
            // Force a stop if stuck in a transitional state
            try {
                 recognitionRef.current.stop();
            } catch {}

            // Set initial text state before starting
            if (initialText.trim()) {
                 finalTranscriptRef.current = initialText.trim() + ' ';
                 setTranscript(initialText.trim());
            } else {
                 resetTranscript();
            }
            
            isManualStopRef.current = false; // Starting means it's not a manual stop

            startSession();
        }
    }, [isListening, resetTranscript, startSession]); 

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            
            isManualStopRef.current = true; // Mark stop as intentional
            recognitionRef.current.stop();
            
            // Note: onend will be triggered immediately, which calls onFinalTranscript.
            // We set isListening=false inside onend.
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