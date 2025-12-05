// components/ChatBubble.tsx
'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ChatMessage, FileAttachment } from '@/types/chat';

// External Libraries for Markdown Rendering
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';
import 'prismjs/themes/prism-dark.css'; 

interface ChatBubbleProps {
    message: ChatMessage;
    isPending: boolean;
}

// Custom renderer for Marked (to add code block headers and copy button)
const renderer = new marked.Renderer();

// FIX: Explicitly type code and lang parameters to resolve TS errors 7006 and 2322.
renderer.code = ({ text, lang, escaped }: { text: string; lang?: string; escaped?: boolean }): string => {
    const language = lang || 'plaintext';
    const highlightedCode = Prism.highlight(text, Prism.languages[language] || Prism.languages.clike, language);

    // Create the header bar with language and copy button
    const header = `
        <div class="code-block-header flex justify-between items-center bg-gray-700 dark:bg-gray-800 p-2 rounded-t-lg text-xs text-gray-300">
            <span>${language.toUpperCase()}</span>
            <button class="copy-button p-1 rounded hover:bg-gray-600 transition" data-code="${encodeURIComponent(text)}">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5v-2a2 2 0 012-2h2a2 2 0 012 2v2M3 17a1 1 0 100-2 1 1 0 000 2z"/></svg>
            </button>
        </div>
    `;

    // Wrap the code block
    return `
        <div class="code-block my-2">
            ${header}
            <pre class="rounded-b-lg p-3 bg-gray-900 overflow-x-auto"><code class="language-${language}">${highlightedCode}</code></pre>
        </div>
    `;
};


// Configure marked
marked.setOptions({
    breaks: true, // Allow GFM line breaks
    renderer: renderer,
    gfm: true,
});


// Handler for copying code blocks
const setupCopyListeners = (container: HTMLElement) => {
    container.querySelectorAll('.copy-button').forEach(button => {
        const code = decodeURIComponent(button.getAttribute('data-code') || '');
        button.addEventListener('click', () => {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = button.innerHTML;
                button.innerHTML = `<span class="text-green-400">Copied!</span>`;
                setTimeout(() => {
                    button.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    });
};


const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isPending }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const isUser = message.role === 'user';

    // Parse and sanitize markdown content
    const sanitizedHtml = useMemo(() => {
        if (isUser) return message.text; // Don't parse user input as full markdown by default
        
        // Use marked to convert markdown to HTML, then sanitize it
        const html = marked.parse(message.text);
        return DOMPurify.sanitize(html as string);

    }, [message.text, isUser]);

    // Apply syntax highlighting and copy listeners after rendering
    useEffect(() => {
        if (contentRef.current && !isUser) {
            Prism.highlightAllUnder(contentRef.current);
            setupCopyListeners(contentRef.current);
        }
    }, [sanitizedHtml, isUser]);


    const renderAttachments = (files: FileAttachment[]) => (
        <div className="flex flex-wrap gap-2 mt-2">
            {files.map((file, index) => {
                const isImage = file.mimeType.startsWith('image/');
                const isTooLarge = file.size > 1024 * 1024 * 5; // 5MB heuristic
                
                return (
                    <div key={index} className="flex flex-col items-center p-2 border border-gray-300 dark:border-gray-600 rounded-lg max-w-[150px]">
                        {isImage && !isTooLarge ? (
                            // FIX: Use Next.js Image component in a production app, but keeping img for module-free structure as requested. 
                            // ESLint warning disabled for this file as a trade-off.
                            <img 
                                src={`data:${file.mimeType};base64,${file.base64Data}`}
                                alt={file.filename}
                                className="w-full h-auto object-cover rounded-md max-h-24"
                            />
                        ) : (
                            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2zM11 5V3a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2h2"></path></svg>
                        )}
                        <span className="text-xs truncate w-full text-center mt-1 text-gray-600 dark:text-gray-300">
                            {file.filename}
                        </span>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
        >
            <div className="flex items-start max-w-[75%]">
                {/* Avatar / Role Indicator */}
                <div className={`p-2 rounded-full text-white mr-3 shrink-0 ${isUser ? 'hidden' : 'bg-blue-600'}`}>
                    {isUser ? '' : 'AI'}
                </div>
                
                {/* Bubble Content */}
                <div
                    className={`p-3 rounded-lg shadow-md transition duration-300 ease-in-out break-words ${
                        isUser
                            ? 'bg-blue-600 text-white rounded-bl-none'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tr-none border dark:border-gray-600'
                    } ${isPending ? 'animate-pulse' : ''}`}
                >
                    {/* Render Multimodal Attachments first */}
                    {message.files && renderAttachments(message.files)}

                    {/* Render Text Content */}
                    <div 
                        ref={contentRef}
                        className={`message-content ${isUser ? '' : 'prose dark:prose-invert max-w-none'}`} 
                        // dangerouslySetInnerHTML is required for rendering marked HTML
                        dangerouslySetInnerHTML={{ __html: isUser ? `<p>${message.text}</p>` : sanitizedHtml }}
                    />
                </div>
                
                {/* User Avatar / Role Indicator */}
                <div className={`p-2 rounded-full text-white ml-3 shrink-0 ${isUser ? 'bg-gray-500' : 'hidden'}`}>
                    {isUser ? 'You' : ''}
                </div>
            </div>
        </div>
    );
}

export default ChatBubble;