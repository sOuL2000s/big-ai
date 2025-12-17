'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react'; // Added useRef
import { ChatMessage } from '@/types/chat';

// Import Markdown libraries used elsewhere in the application
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownExportModalProps {
    conversationTitle: string;
    messages: ChatMessage[];
    onClose: () => void;
}

// Helper function to format the entire chat into a single Markdown string
const formatMessagesToMarkdown = (title: string, messages: ChatMessage[]): string => {
    let markdown = `# Conversation: ${title}\n\n`;
    
    messages.forEach(msg => {
        // Format the message content
        const role = msg.role === 'user' ? 'You' : 'AI';
        const timestamp = new Date(msg.timestamp).toLocaleString();
        
        markdown += `---
## ${role} (${timestamp})

`;
        // Handle files in Markdown format (if possible, otherwise mention them)
        if (msg.files && msg.files.length > 0) {
            markdown += `[File Attachments: ${msg.files.map(f => f.filename).join(', ')}]\n\n`;
        }
        
        // Ensure the message text is included. Assuming the stored message text is already Markdown.
        // We trim here to ensure clean blocks.
        markdown += msg.text.trim() + '\n\n';
    });
    
    return markdown;
};

// --- NEW DOWNLOAD UTILITIES ---

// 1. Download RAW Markdown
const downloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 2. Download PDF via Print Dialog
const printPDF = (htmlContent: string) => {
    // Open a new window to render the HTML content for printing
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    // Use a minimal HTML structure to ensure clean printing
    printWindow.document.write(`
        <html>
            <head>
                <title>Export PDF: ${name}</title>
                <style>
                    /* Basic print styles to make the output readable */
                    body { font-family: sans-serif; margin: 20px; color: #000; }
                    pre { background: #eee; padding: 10px; border: 1px solid #ccc; white-space: pre-wrap; }
                    code { background: #eee; padding: 2px 4px; border-radius: 3px; }
                    /* Style for the marked/purified HTML content */
                    .printable-content { max-width: 800px; margin: 0 auto; }
                    .printable-content h1 { border-bottom: 2px solid #000; padding-bottom: 5px; margin-top: 1.5em; }
                    .printable-content h2 { border-bottom: 1px solid #aaa; padding-bottom: 3px; margin-top: 1em; }
                    .printable-content p { margin-bottom: 1em; }
                </style>
            </head>
            <body>
                <div class="printable-content">
                    ${htmlContent}
                </div>
                <script>
                    // Wait for styles and content to load, then print
                    window.onload = function() {
                        setTimeout(() => {
                             window.print();
                             window.close();
                        }, 500); // 500ms delay ensures rendering/styles are applied
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

export default function MarkdownExportModal({ conversationTitle, messages, onClose }: MarkdownExportModalProps) {
    // Ref for the HTML preview content, needed for PDF print
    const previewRef = useRef<HTMLDivElement>(null); 
    
    // 1. Generate Markdown content
    const markdownContent = useMemo(() => formatMessagesToMarkdown(conversationTitle, messages), [conversationTitle, messages]);
    
    // 2. Prepare HTML preview
    const sanitizedHtml = useMemo(() => {
        // Use marked and DOMPurify for the preview pane
        return DOMPurify.sanitize(marked.parse(markdownContent) as string);
    }, [markdownContent]);
    
    const [copyStatus, setCopyStatus] = useState<'copy' | 'copied'>('copy');

    const handleCopy = () => {
        navigator.clipboard.writeText(markdownContent).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('copy'), 2000);
        }).catch(err => {
            console.error("Failed to copy markdown:", err);
        });
    };

    const handleDownloadMd = () => {
        downloadMarkdown(conversationTitle, markdownContent);
    };
    
    const handleDownloadPdf = () => {
        // Get the inner HTML content of the preview pane (which is the sanitized, rendered chat)
        if (previewRef.current) {
            printPDF(previewRef.current.innerHTML);
        } else {
            // Fallback: use the raw sanitized HTML string if the ref is somehow missing content
            printPDF(sanitizedHtml);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg shadow-2xl border" 
                 style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}>
                
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b" style={{borderColor: 'var(--border-color)'}}>
                    <h2 className="text-xl font-bold">Export Chat: {conversationTitle}</h2>
                    <button onClick={onClose} className="p-1 rounded hover:opacity-80 transition" style={{color: 'var(--text-secondary)'}}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                {/* Content Area */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden p-4 gap-4">
                    
                    {/* Markdown Editor (Raw Content) */}
                    <div className="flex-1 flex flex-col min-h-[200px] md:min-h-full">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-md font-semibold" style={{color: 'var(--accent-primary)'}}>Raw Markdown</h3>
                            <div className="flex gap-2">
                                {/* NEW: Download MD Button */}
                                <button 
                                    onClick={handleDownloadMd} 
                                    className="px-3 py-1 text-sm rounded transition flex items-center gap-1"
                                    style={{
                                        backgroundColor: 'var(--accent-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Download MD
                                </button>
                                
                                {/* Copy Button */}
                                <button 
                                    onClick={handleCopy} 
                                    className="px-3 py-1 text-sm rounded transition flex items-center gap-1"
                                    style={{
                                        backgroundColor: copyStatus === 'copied' ? 'var(--accent-success)' : 'var(--accent-primary)',
                                        color: 'var(--ai-bubble-text)'
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={copyStatus === 'copied' ? "M5 13l4 4L19 7" : "M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5v-2a2 2 0 012-2h2a2 2 0 012 2v2m-3 7h3m-3 4h3"}></path></svg>
                                    {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={markdownContent}
                            readOnly
                            className="flex-1 w-full p-3 rounded-md border resize-none font-mono text-sm"
                            style={{backgroundColor: 'var(--code-block-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                        />
                    </div>
                    
                    {/* Markdown Preview */}
                    <div className="flex-1 flex flex-col min-h-[200px] md:min-h-full overflow-y-auto border p-3 rounded-md" 
                         style={{backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}>
                        
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-md font-semibold" style={{color: 'var(--accent-primary)'}}>Preview</h3>
                            {/* NEW: Download PDF Button */}
                            <button 
                                onClick={handleDownloadPdf} 
                                className="px-3 py-1 text-sm rounded transition flex items-center gap-1"
                                style={{
                                    backgroundColor: 'var(--accent-primary)',
                                    color: 'var(--ai-bubble-text)'
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                                Download PDF
                            </button>
                        </div>
                        
                        {/* Attach ref to the preview content container */}
                        <div 
                           ref={previewRef} 
                           dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                           className="text-base markdown-preview-content" 
                        >
                            {/* Content injected here */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}