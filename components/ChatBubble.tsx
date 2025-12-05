// components/ChatBubble.tsx
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ChatMessage, FileAttachment } from '@/types/chat';

// External Libraries for Markdown Rendering
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import 'prismjs/themes/prism-dark.css'; 

// Import specific Prism languages needed
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';


// --- TTS / DICTATION UTILITY (Client-side implementation) ---
// Global state for TTS to ensure only one message is speaking at a time
let isSpeaking = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentButtonRef: React.MutableRefObject<HTMLButtonElement | null> | null = null;

const startSpeech = (text: string, buttonRef: React.MutableRefObject<HTMLButtonElement | null>) => {
    if (!window.speechSynthesis) return console.error('Speech synthesis not supported.');

    // Cancel any current speaking message
    if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
        window.speechSynthesis.cancel();
    }
    
    // Reset icon on the previously speaking button, if applicable
    if (currentButtonRef && currentButtonRef.current) {
        const iconSpan = currentButtonRef.current.querySelector('[data-icon="tts"]');
        // Reset to Speak icon (volume-2 equivalent)
        if (iconSpan) iconSpan.innerHTML = `<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464l-2.071 2.071-2.071-2.071m4.142 4.142l-2.071 2.071m0 0l-2.071-2.071M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';

    utterance.onstart = () => {
        isSpeaking = true;
        currentUtterance = utterance;
        currentButtonRef = buttonRef;
        const iconSpan = buttonRef.current?.querySelector('[data-icon="tts"]');
        // Change to Pause icon (stop circle equivalent)
        if (iconSpan) iconSpan.innerHTML = `<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`; 
    };
    utterance.onend = () => {
        isSpeaking = false;
        currentUtterance = null;
        currentButtonRef = null;
        const iconSpan = buttonRef.current?.querySelector('[data-icon="tts"]');
        // Reset to Speak icon
        if (iconSpan) iconSpan.innerHTML = `<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464l-2.071 2.071-2.071-2.071m4.142 4.142l-2.071 2.071m0 0l-2.071-2.071M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>`; 
    };
    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        isSpeaking = false;
        currentUtterance = null;
        currentButtonRef = null;
    };

    window.speechSynthesis.speak(utterance);
}

const toggleSpeech = (text: string, buttonRef: React.MutableRefObject<HTMLButtonElement | null>) => {
    if (!window.speechSynthesis) return;

    if (isSpeaking && currentUtterance?.text === text) {
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        } else {
            window.speechSynthesis.pause();
        }
    } else {
        startSpeech(text, buttonRef);
    }
};

// --- MARKED CUSTOM RENDERER ---
const renderer = new marked.Renderer();

// Custom code block renderer
renderer.code = ({ text, lang, escaped }: { text: string; lang?: string; escaped?: boolean }): string => {
    const language = lang || 'plaintext';
    // Marked escapes HTML entities; we need to unescape for Prism to work correctly.
    const unescapedCode = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    
    const header = `
        <div class="code-block-header flex justify-between items-center">
            <span class="text-xs font-semibold uppercase" style="color: var(--text-secondary);">${language}</span>
            <button type="button" class="copy-button p-1 rounded transition flex items-center gap-1 text-xs" 
                data-code="${encodeURIComponent(unescapedCode)}" 
                style="color: var(--text-secondary); padding: 0.25rem 0.5rem;">
                <span data-icon="clipboard">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5v-2a2 2 0 012-2h2a2 2 0 012 2v2m-3 7h3m-3 4h3"></path></svg>
                </span>
                <span data-text="Copy">Copy</span>
            </button>
        </div>
    `;

    return `
        <div class="code-block-container" data-lang="${language}">
            ${header}
            <pre><code class="language-${language}">${unescapedCode}</code></pre>
        </div>
    `;
};


marked.setOptions({
    breaks: true,
    renderer: renderer,
    gfm: true,
});

// --- REACT COMPONENT ---

interface ChatBubbleProps {
    message: ChatMessage;
    isPending: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isPending }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const copyButtonRef = useRef<HTMLButtonElement | null>(null);
    const dictateButtonRef = useRef<HTMLButtonElement | null>(null);
    const isUser = message.role === 'user';

    // Parse and sanitize markdown content
    const sanitizedHtml = useMemo(() => {
        if (isUser) {
            // Only convert simple line breaks to <p> tags for cleaner display of user input
            // NOTE: Must sanitize before applying manual line breaks if using DOMPurify
            const safeText = DOMPurify.sanitize(message.text);
            return `<p>${safeText.replace(/\n/g, '<br/>')}</p>`;
        }
        
        const html = marked.parse(message.text);
        // DOMPurify sanitizes the entire generated HTML
        return DOMPurify.sanitize(html as string);
    }, [message.text, isUser]);

    // Apply syntax highlighting and copy listeners after rendering
    useEffect(() => {
        if (contentRef.current && !isUser) {
            // 1. Syntax highlighting
            contentRef.current.querySelectorAll('pre code').forEach((block) => {
                try {
                    // This is client-side code, Prism should be globally available via imported modules
                    Prism.highlightElement(block);
                } catch (e) {
                    console.error("Prism highlighting failed:", e);
                }
            });
            
            // 2. Setup Copy Listeners for code blocks
            contentRef.current.querySelectorAll('.copy-button').forEach(button => {
                const encodedCode = button.getAttribute('data-code');
                if (!encodedCode) return;

                const code = decodeURIComponent(encodedCode);
                
                // Use functional component lifecycle to manage event listeners for cleanliness
                const handleCopy = (e: Event) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(code).then(() => {
                        const iconSpan = button.querySelector('[data-icon="clipboard"]');
                        const textSpan = button.querySelector('[data-text]');
                        
                        // Checkmark icon
                        if (iconSpan) iconSpan.innerHTML = `<svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>`;
                        if (textSpan) textSpan.textContent = "Copied!";

                        setTimeout(() => {
                            // Clipboard icon
                            if (iconSpan) iconSpan.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5v-2a2 2 0 012-2h2a2 2 0 012 2v2m-3 7h3m-3 4h3"></path></svg>`;
                            if (textSpan) textSpan.textContent = "Copy";
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                };
                
                // Ensure listener is added only once
                button.removeEventListener('click', handleCopy as EventListener); 
                button.addEventListener('click', handleCopy as EventListener);
            });
        }
    }, [sanitizedHtml, isUser]);

    // Cleanup TTS on unmount
    useEffect(() => {
        return () => {
            // Check if this component's button was the one currently speaking
            if (currentButtonRef === dictateButtonRef && window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                isSpeaking = false;
                currentUtterance = null;
                currentButtonRef = null;
            }
        };
    }, []);

    const handleCopyText = () => {
        navigator.clipboard.writeText(message.text)
            .then(() => {
                 // Provide visual feedback by temporarily changing the icon
                 const iconSpan = copyButtonRef.current?.querySelector('svg');
                 if (iconSpan && copyButtonRef.current) {
                     // Checkmark icon
                     copyButtonRef.current.style.color = 'var(--accent-success)';
                     iconSpan.outerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>`;
                     
                     setTimeout(() => {
                         // Clipboard icon
                         if (copyButtonRef.current) {
                             copyButtonRef.current.style.color = 'var(--text-secondary)';
                         }
                         iconSpan.outerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5v-2a2 2 0 012-2h2a2 2 0 012 2v2m-3 7h3m-3 4h3"></path></svg>`;
                     }, 2000);
                 }
            })
            .catch(err => console.error("Copy failed:", err));
    };


    const renderAttachments = (files: FileAttachment[]) => (
        <div className="flex flex-wrap gap-2 mt-2">
            {files.map((file, index) => {
                const isImage = file.mimeType.startsWith('image/');
                const isTooLarge = file.size > 1024 * 1024 * 5; // 5MB heuristic
                
                return (
                    <div key={index} className="flex flex-col items-center p-2 rounded-lg max-w-[150px]" style={{border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)'}}>
                        {isImage && !isTooLarge ? (
                            <img 
                                src={`data:${file.mimeType};base64,${file.base64Data}`}
                                alt={file.filename}
                                className="w-full h-auto object-cover rounded-md max-h-24"
                            />
                        ) : (
                            // File icon placeholder
                            <svg className="w-8 h-8" style={{color: 'var(--accent-secondary)'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-2.414-2.414A1 1 0 0015.586 6H7a2 2 0 00-2 2v11a2 2 0 002 2zM17 17H7m10-4H7m4-4H7"></path></svg>
                        )}
                        <span className="text-xs truncate w-full text-center mt-1" style={{color: 'var(--text-secondary)'}}>
                            {file.filename}
                        </span>
                    </div>
                );
            })}
        </div>
    );

    return (
        // Added 'group' class here to enable CSS hover effects for message actions
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
            <div className="flex items-start max-w-[75%]">
                {/* Avatar / Role Indicator (AI) */}
                <div className={`p-2 rounded-full text-white mr-3 shrink-0 self-start ${isUser ? 'hidden' : 'bg-blue-600'}`} style={{backgroundColor: isUser ? 'var(--text-primary)' : 'var(--accent-primary)'}}>
                    {isUser ? '' : 'AI'}
                </div>
                
                {/* Bubble Content */}
                <div
                    className={`p-3 rounded-xl shadow-md transition duration-300 ease-in-out break-words relative ${
                        isUser
                            ? 'rounded-bl-none'
                            : 'rounded-tr-none border'
                    }`}
                    style={{
                        backgroundColor: isUser ? 'var(--user-bubble-bg)' : 'var(--ai-bubble-bg)',
                        color: isUser ? 'var(--user-bubble-text)' : 'var(--ai-bubble-text)',
                        borderColor: isUser ? 'transparent' : 'var(--border-color)'
                    }}
                >
                    {/* Render Multimodal Attachments first */}
                    {message.files && renderAttachments(message.files)}

                    {/* Render Text Content */}
                    <div 
                        ref={contentRef}
                        className={`message-content ${isUser ? '' : 'prose max-w-none'}`} 
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />

                    {/* Message Actions (Copy/Dictate) */}
                    <div className="absolute bottom-1 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg" 
                        style={{
                            backgroundColor: 'var(--header-bg)', 
                            border: '1px solid var(--border-color)',
                            // Use ternary operator to position the action buttons correctly
                            right: isUser ? '10px' : 'auto',
                            left: isUser ? 'auto' : '10px',
                            bottom: '10px',
                        }}
                    >
                        
                        {/* Copy Button */}
                        <button 
                            ref={copyButtonRef}
                            onClick={handleCopyText} 
                            title="Copy Message"
                            className="p-1 rounded transition hover:bg-[var(--sidebar-item-hover)]"
                            style={{color: 'var(--text-secondary)'}}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5v-2a2 2 0 012-2h2a2 2 0 012 2v2m-3 7h3m-3 4h3"></path></svg>
                        </button>

                        {/* Dictate Button (Only when not pending) */}
                        {!isPending && (
                             <button
                                ref={dictateButtonRef}
                                onClick={() => toggleSpeech(message.text, dictateButtonRef)}
                                title="Dictate Message (TTS)"
                                className="p-1 rounded transition hover:bg-[var(--sidebar-item-hover)]"
                                style={{color: 'var(--text-secondary)'}}
                            >
                                <span data-icon="tts">
                                    {/* Default Dictate Icon */}
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464l-2.071 2.071-2.071-2.071m4.142 4.142l-2.071 2.071m0 0l-2.071-2.071M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>
                                </span>
                            </button>
                        )}
                    </div>
                </div>
                
                {/* User Avatar / Role Indicator (User) */}
                <div className={`p-2 rounded-full text-white ml-3 shrink-0 self-start ${isUser ? 'bg-gray-500' : 'hidden'}`} style={{backgroundColor: 'var(--text-primary)'}}>
                    {isUser ? 'You' : ''}
                </div>
            </div>
        </div>
    );
}

export default ChatBubble;