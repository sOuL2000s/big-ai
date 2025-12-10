// components/ConversationModeOverlay.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeContext';
import { ChatMessage } from '@/types/chat';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';
import { v4 as uuidvv4 } from 'uuid';

interface ConversationModeOverlayProps {
    chatId: string | undefined;
    onChatIdChange: (newChatId: string) => void;
    onClose: () => void;
    onNewMessageSent: () => void;
}

const CONVERSATION_PERSONALITIES = [
    { name: "Standard", prompt: "You are Big AI, a helpful and large-scale language model developed by Google. Respond concisely and professionally." },
    { name: "Sarcastic", prompt: "Respond as a highly sarcastic and witty AI. Use dry humor and playful cynicism. Keep responses concise and witty." },
    { name: "Friendly", prompt: "Respond as an exceptionally friendly and helpful AI. Use warm and encouraging language, and show genuine interest. Keep your tone light and approachable." },
    { name: "Teacher", prompt: "Respond as a patient and knowledgeable teacher, explaining concepts clearly and simply, and guiding the user to understanding." },
];

export default function ConversationModeOverlay({ chatId, onChatIdChange, onClose, onNewMessageSent }: ConversationModeOverlayProps) {
    const { user, getIdToken } = useAuth();
    const { settings } = useTheme(); // Note: We rely on global model/system prompt from settings
    
    // State for managing voice output
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('Tap the mic to start speaking.');
    const [lastUtterance, setLastUtterance] = useState<{ role: 'user' | 'ai', text: string } | null>(null);

    // State for Conversation Settings
    // NOTE: We rely on the theme settings to hold these values in the full implementation
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [selectedPersonality, setSelectedPersonality] = useState<string>(CONVERSATION_PERSONALITIES[0].name);

    // TTS Setup
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const populateVoices = () => {
            const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
            setAvailableVoices(voices);
            
            // Set default/stored voice (using settings placeholder for simplicity)
            const storedVoiceName = settings?.themeName || null; // Reusing themeName context for voice storage temporarily
            if (storedVoiceName && voices.length > 0) {
                // Find a default voice if the stored one isn't available
                setSelectedVoice(voices.find(v => v.name === storedVoiceName)?.name || voices[0].name);
            } else if (voices.length > 0) {
                 // Set a default if nothing is stored
                 setSelectedVoice(voices[0].name);
            }
        };

        populateVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoices;
        }

        // Load conversation settings from global settings
        if (settings) {
            // Check if globalSystemPrompt is active (handled via the PromptManager)
            if (settings.globalSystemPrompt.trim()) {
                setSelectedPersonality('Custom Prompt');
            } else {
                 // Fallback to the default personality if custom prompt is inactive
                setSelectedPersonality(CONVERSATION_PERSONALITIES[0].name);
            }
        }
        
        // Cleanup TTS on component unmount
        return () => {
            if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
                window.speechSynthesis.cancel();
            }
        };

    }, [settings]);

    // Speech Recognition Hook for the Conversation Loop
    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening, 
        recognitionSupported,
        resetTranscript
    } = useSpeechRecognition({
        continuous: false, // Ensure it stops after detecting a pause
        onStart: () => {
            // Only update status if AI isn't currently speaking
            if (!isAiSpeaking) {
                setStatus('listening');
                setStatusMessage('Listening...');
                setLastUtterance({ role: 'user', text: '' });
            }
        },
        onFinalTranscript: (finalTranscript) => {
            setLastUtterance({ role: 'user', text: finalTranscript });
            // Immediately stop listening if we got a final transcript, as continuous is false
            stopListening();
            handleUserSpeechEnd(finalTranscript);
        },
        onInterimTranscript: (interimTranscript) => {
             // Update interim text displayed to user
             setLastUtterance(prev => ({ role: 'user', text: (prev?.text || '') + interimTranscript }));
        },
        onEnd: () => {
            if (status === 'listening') {
                // If it ended without a final transcript (e.g., no speech detected, or user paused too long)
                setStatus('idle');
                setStatusMessage('No speech detected. Tap the mic to try again.');
            }
        },
        onError: (error) => {
            console.error("Conversation STT Error:", error);
            setStatus('error');
            setStatusMessage(`Error: ${error}. Tap the mic to restart.`);
             setTimeout(() => {
                setStatus('idle');
                setStatusMessage('Tap the mic to start speaking.');
            }, 5000);
        }
    });


    // --- Core Conversation Loop Handlers ---

    const handleUserSpeechEnd = async (userText: string) => {
        if (!userText.trim()) {
            setStatus('idle');
            setStatusMessage('No speech detected. Tap the mic to try again.');
            return;
        }
        
        setStatus('thinking');
        setStatusMessage('AI is thinking...');

        try {
            const token = await getIdToken();
            
            // Determine the system prompt based on settings
            const systemPrompt = settings?.globalSystemPrompt.trim();
            const personalityPrompt = CONVERSATION_PERSONALITIES.find(p => p.name === selectedPersonality)?.prompt;
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify({
                    message: userText,
                    chatId: chatId, 
                    // Pass system prompt only for NEW chats, or if we want to explicitly use a personality prompt
                    globalSystemPrompt: chatId ? systemPrompt : (systemPrompt || personalityPrompt), 
                }),
            });
            
            if (!response.ok) {
                let errorMsg = `API responded with status ${response.status}.`;
                
                // Attempt to read the detailed JSON error payload
                if (response.headers.get('Content-Type')?.includes('application/json')) {
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                        if (errorData.details) {
                            errorMsg += `\n\nDebug Details: ${errorData.details}`;
                        }
                    } catch {}
                }

                // Throw error with extracted message
                throw new Error(errorMsg);
            }

            const newChatId = response.headers.get('X-Chat-ID');
            if (newChatId && newChatId !== chatId) {
                onChatIdChange(newChatId); 
            }
            
            // Read streamed response (assuming the API is designed to return plain text in this route)
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullBotResponse = '';

            // This is a simplified stream reading compared to ChatArea, as we need the full text before TTS
            while (reader) {
                 const { done, value } = await reader.read();
                 if (done) break;
                 fullBotResponse += decoder.decode(value);
            }
            
            setLastUtterance({ role: 'ai', text: fullBotResponse });
            startSpeaking(fullBotResponse);
            onNewMessageSent(); // Trigger sidebar refresh
            
        } catch (error) {
            console.error('Conversation AI Error:', error);
            setStatus('error');
            // Show the detailed error message captured above, stripping debug details for the small overlay
            const message = error instanceof Error 
                ? error.message.replace(/\n\n--- Debug Details ---.*/s, '') 
                : 'Unknown communication error.';
                
            setStatusMessage(`AI Error: ${message}`);

            setTimeout(() => {
                if (recognitionSupported) {
                    setStatus('idle');
                    setStatusMessage('Tap the mic to restart.');
                }
            }, 5000);
        }
    };
    
    const startSpeaking = (text: string) => {
        if (!window.speechSynthesis) return;

        setStatus('speaking');
        setStatusMessage('AI Speaking...');
        setIsAiSpeaking(true);

        const utterance = new SpeechSynthesisUtterance(text);
        
        const voice = availableVoices.find(v => v.name === selectedVoice);
        if (voice) {
            utterance.voice = voice;
        }
        
        utterance.onend = () => {
            setIsAiSpeaking(false);
            // After AI speaks, restart listening
            if (recognitionSupported) {
                 // Slight delay before restarting mic to prevent capturing residual sound
                 setTimeout(() => startListening(), 500); 
            } else {
                 setStatus('idle');
                 setStatusMessage('Conversation finished. Speech recognition disabled.');
            }
        };
        utterance.onerror = (e) => {
            console.error('TTS Error:', e);
            setIsAiSpeaking(false);
            if (recognitionSupported) {
                 setTimeout(() => startListening(), 500); 
            } else {
                 setStatus('idle');
            }
        }

        window.speechSynthesis.speak(utterance);
    };

    const handleMicToggle = () => {
        if (!user) return;
        
        if (isAiSpeaking) {
            window.speechSynthesis.cancel();
            setIsAiSpeaking(false);
            setStatus('idle');
            setStatusMessage('AI speech canceled. Tap the mic to restart.');
        } else if (isListening) {
            stopListening();
            setStatus('idle');
            setStatusMessage('Listening stopped. Tap the mic to restart.');
        } else {
            if (!recognitionSupported) {
                 setStatus('error');
                 setStatusMessage("Speech Recognition is not supported in this browser.");
                 return;
            }
            // Reset state and start listening
            resetTranscript();
            setLastUtterance(null);
            startListening();
        }
    };
    
    // UI mapping
    const soundBlobState = isListening ? 'listening' : (isAiSpeaking ? 'speaking' : 'idle');
    const micButtonState = isListening || isAiSpeaking;

    const currentPersonalityDisplay = settings?.globalSystemPrompt.trim() 
        ? 'Custom Prompt' 
        : CONVERSATION_PERSONALITIES.find(p => p.name === selectedPersonality)?.name || 'Standard';

    return (
        <div 
            className="fixed inset-0 flex flex-col items-center justify-center p-4 transition-opacity duration-500"
            style={{backgroundColor: 'var(--conversation-bg)', color: 'var(--conversation-text)', zIndex: 100}}
        >
            <button id="conversation-mode-close-btn" onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 transition" style={{color: 'var(--text-secondary)'}}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="conversation-controls absolute top-4 flex gap-4 p-3 rounded-full border" style={{borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)'}}>
                <div className='flex items-center gap-2 text-sm'>
                    <span style={{color: 'var(--accent-primary)'}}>Voice:</span> 
                    <select
                        value={selectedVoice || ''}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        disabled={isListening || isAiSpeaking}
                        className="p-1 rounded border" style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'}}
                    >
                        {availableVoices.map(voice => (
                            <option key={voice.name} value={voice.name}>{voice.name}</option>
                        ))}
                    </select>
                </div>
                <div className='flex items-center gap-2 text-sm'>
                     <span style={{color: 'var(--accent-primary)'}}>Personality:</span> 
                    <span className='font-semibold'>{currentPersonalityDisplay}</span>
                </div>
            </div>

            {/* Sound Blob Animation Area */}
            <div className="relative w-72 h-72 flex items-center justify-center mt-20 mb-8">
                {/* Note: Tailwind doesn't easily support the complex CSS animations/shapes from Part 2,
                    so we use simple concentric circles driven by state variables. */}
                <div 
                    className={`absolute w-full h-full rounded-full transition-all duration-500 blur-lg 
                        ${soundBlobState === 'listening' ? 'scale-110 opacity-70' : soundBlobState === 'speaking' ? 'scale-105 opacity-80' : 'scale-90 opacity-50'}`}
                    style={{backgroundColor: 'var(--conversation-indicator)'}}
                ></div>
                 <div 
                    className={`absolute w-40 h-40 flex items-center justify-center rounded-full transition-all duration-500`}
                    style={{backgroundColor: 'var(--card-bg)', color: 'var(--conversation-indicator)'}}
                >
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M4.343 19.657l.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                </div>
            </div>

            <div className={`text-3xl font-extrabold text-center mb-6 min-h-[3rem] transition-colors duration-300`} 
                 style={{color: status === 'error' ? 'var(--accent-error)' : 'var(--text-primary)'}}
            >
                {statusMessage}
            </div>

            <div className="w-full max-w-xl h-24 overflow-y-auto p-3 rounded-xl border mb-8" 
                 style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)'}}
            >
                {lastUtterance ? (
                    <p className={`text-lg ${lastUtterance.role === 'user' ? 'text-blue-400' : 'text-green-400'} font-semibold truncate`}>
                        {lastUtterance.role === 'user' ? 'You: ' : 'AI: '}
                        {lastUtterance.text}
                    </p>
                ) : (
                    <p className='text-center italic'>Recent speech appears here.</p>
                )}
            </div>

            <button 
                onClick={handleMicToggle} 
                className={`w-20 h-20 rounded-full shadow-xl transition-all duration-300 ${micButtonState ? 'voice-input-active' : ''}`}
                title={micButtonState ? "Stop" : "Start Listening"}
                style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}}
            >
                <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v0a7 7 0 01-7-7v0a7 7 0 0114 0zM12 18v3m4 0H8m6-12a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </button>
            <p className='text-xs mt-4' style={{color: 'var(--text-secondary)'}}>
                {isAiSpeaking ? 'Click to stop AI speech.' : (isListening ? 'Click to stop listening.' : 'Click to speak.')}
            </p>
        </div>
    );
}