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

const DEFAULT_MODEL = 'gemini-2.5-flash-preview-09-2025';

export default function ConversationModeOverlay({ chatId, onChatIdChange, onClose, onNewMessageSent }: ConversationModeOverlayProps) {
    const { user, getIdToken } = useAuth();
    const { settings, updateSettings } = useTheme();
    
    // State for managing voice output
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('Tap the mic to start speaking.');
    const [lastUtterance, setLastUtterance] = useState<{ role: 'user' | 'ai', text: string } | null>(null);

    // State for Conversation Settings
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [selectedPersonality, setSelectedPersonality] = useState<string>(CONVERSATION_PERSONALITIES[0].name);

    // TTS Setup
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const populateVoices = () => {
            const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
            setAvailableVoices(voices);
            
            // Set default/stored voice
            const storedVoiceName = settings?.themeName || null;
            if (storedVoiceName) {
                setSelectedVoice(voices.find(v => v.name === storedVoiceName)?.name || null);
            }
        };

        populateVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoices;
        }

        // Load conversation settings from global settings
        if (settings) {
            setSelectedPersonality(settings.globalSystemPrompt ? 'Custom Prompt' : CONVERSATION_PERSONALITIES[0].name);
        }

        return () => {
            window.speechSynthesis.cancel();
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
            setStatus('listening');
            setStatusMessage('Listening...');
            setLastUtterance({ role: 'user', text: '' });
        },
        onFinalTranscript: (finalTranscript) => {
            setLastUtterance({ role: 'user', text: finalTranscript });
            handleUserSpeechEnd(finalTranscript);
        },
        onEnd: () => {
            if (status === 'listening') {
                // If it ended without a final transcript (e.g., no speech detected)
                setStatus('idle');
                setStatusMessage('No speech detected. Tap the mic to try again.');
            }
        },
        onError: (error) => {
            console.error("Conversation STT Error:", error);
            setStatus('error');
            setStatusMessage(`Error: ${error}. Tap the mic to restart.`);
        }
    });

    const conversationHistory: ChatMessage[] = useMemo(() => {
        // Fetch current chat history if available, otherwise start new
        // NOTE: In a real app, this should fetch history specific to the current chatId
        // For simplicity in this component, we rely on the chat being active/loaded in the parent
        return []; 
    }, [chatId]);

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
            
            // Construct request payload
            const historyForApi: ChatMessage[] = [...conversationHistory, { 
                id: uuidvv4(), 
                text: userText, 
                role: 'user', 
                timestamp: Date.now() 
            }];
            
            const systemPrompt = settings?.globalSystemPrompt.trim();

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, 
                },
                body: JSON.stringify({
                    message: userText,
                    chatId: chatId, 
                    // Pass current system prompt for context, prioritizing global setting
                    globalSystemPrompt: systemPrompt, 
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API returned status ${response.status}`);
            }

            const newChatId = response.headers.get('X-Chat-ID');
            if (newChatId && newChatId !== chatId) {
                onChatIdChange(newChatId); 
            }
            
            // Stream processing (simplified for non-streaming context here)
            const fullBotResponse = await response.text();
            
            setLastUtterance({ role: 'ai', text: fullBotResponse });
            startSpeaking(fullBotResponse);
            onNewMessageSent(); // Trigger sidebar refresh
            
        } catch (error) {
            console.error('Conversation AI Error:', error);
            setStatus('error');
            setStatusMessage(`AI Error: ${error instanceof Error ? error.message : 'Unknown communication error.'}`);
            setTimeout(() => {
                setStatus('idle');
                setStatusMessage('Tap the mic to restart.');
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
                 setTimeout(() => startListening(), 500); 
            } else {
                 setStatus('idle');
                 setStatusMessage('Conversation finished. Speech recognition disabled.');
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    const handleMicToggle = () => {
        if (!recognitionSupported) {
            setStatus('error');
            setStatusMessage("Speech Recognition is not supported in this browser.");
            return;
        }
        
        if (isAiSpeaking) {
            window.speechSynthesis.cancel();
            setIsAiSpeaking(false);
            setStatus('idle');
            setStatusMessage('AI speech canceled.');
        } else if (isListening) {
            stopListening();
            setStatus('idle');
            setStatusMessage('Listening stopped.');
        } else {
            // Reset state and start listening
            resetTranscript();
            setLastUtterance(null);
            startListening();
        }
    };
    
    // UI mapping
    const soundBlobState = isListening ? 'listening' : (isAiSpeaking ? 'speaking' : 'idle');
    const micButtonState = isListening || isAiSpeaking;

    const currentVoice = availableVoices.find(v => v.name === selectedVoice);
    const currentPersonality = settings?.globalSystemPrompt.trim() 
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
                    <span className='font-semibold'>{currentPersonality}</span>
                </div>
            </div>

            {/* Sound Blob Animation Area */}
            <div className="relative w-72 h-72 flex items-center justify-center mt-20 mb-8">
                <div 
                    className={`absolute w-full h-full rounded-full transition-all duration-500 ${soundBlobState === 'listening' ? 'scale-110 opacity-70 blur-md' : soundBlobState === 'speaking' ? 'scale-105 opacity-80 blur-sm' : 'scale-90 opacity-50 blur-lg'}`}
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