// components/ChatArea.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef, ChangeEvent, DragEvent as ReactDragEvent, KeyboardEvent } from 'react';
import { ChatMessage, Conversation, FileAttachment } from '@/types/chat';
import ChatBubble from './ChatBubble'; 
import { useAuth } from '@/components/providers/AuthProvider';
import { v4 as uuidvv4 } from 'uuid';
import { useTheme } from '@/components/providers/ThemeContext'; // NEW
import useSpeechRecognition from '@/hooks/useSpeechRecognition'; // NEW HOOK (to be created)

const BOT_PENDING_ID = 'bot-pending';

interface ChatAreaProps {
    chatId: string | undefined;
    onChatIdChange: (newChatId: string) => void;
    onNewMessageSent: () => void; // Trigger sidebar refresh
    onOpenConversationMode: () => void; // NEW
}

// Utility to convert file to Base64
const fileToBase64 = (file: File): Promise<FileAttachment> => {
    // ... (utility function remains the same as in part 1)
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const [, base64Data] = result.split(',');
            if (base64Data) {
                resolve({
                    base64Data: base64Data,
                    mimeType: file.type,
                    filename: file.name,
                    size: file.size,
                });
            } else {
                reject(new Error("Failed to read file data."));
            }
        };
        reader.onerror = (error) => reject(error);
    });
};


export default function ChatArea({ chatId, onChatIdChange, onNewMessageSent, onOpenConversationMode }: ChatAreaProps) {
  const { user, getIdToken } = useAuth();
  const { settings } = useTheme();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]); 
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // NEW: Speech Recognition Hook Integration
  const { isListening, transcript, startListening, stopListening, recognitionSupported, resetTranscript } = useSpeechRecognition({ 
      onFinalTranscript: (finalTranscript) => {
          setInput(prev => (prev.trim() + ' ' + finalTranscript).trim());
          resetTranscript();
      },
      onInterimTranscript: (interimTranscript) => {
        // Use interim transcript for instant visual feedback
        setInput(prev => (prev.split(' ')[0] + ' ' + interimTranscript).trim());
      },
      onStart: () => {
          // Temporarily disable sending when listening starts
          // We rely on the input state being updated by the hook
      },
      onEnd: () => {
         // Focus on input after listening stops
         inputRef.current?.focus();
      }
  });


  // Combine hook transcript with input state
  useEffect(() => {
    // If listening and transcript changes, we don't update input directly here, 
    // the hook manages it via onFinalTranscript and onInterimTranscript handlers provided above.
    // We update the placeholder dynamically based on listening state.
    if (inputRef.current) {
        inputRef.current.placeholder = isLoading 
            ? "Please wait..." 
            : (isListening 
                ? "Listening... Speak now." 
                : (attachments.length > 0 ? `Message Big AI about ${attachments.length} files...` : "Message Big AI..."));
    }
  }, [isLoading, isListening, attachments.length]);
  
  // Dynamic Input Height Adjustment 
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; 
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);


  // --- History Loading Effect ---
  useEffect(() => {
    // ... (History loading logic remains the same, using settings data for potential conversation config is done in the API route)
    if (!user) return;

    if (chatId) {
      setIsHistoryLoading(true);
      setMessages([]); // Clear old messages
      
      const fetchChatHistory = async () => {
        try {
          const token = await getIdToken();
          const response = await fetch(`/api/chat?chatId=${chatId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const conversation: Conversation = await response.json();
            const clientMessages: ChatMessage[] = conversation.messages.map(m => ({
                ...m,
                timestamp: new Date(m.timestamp),
            }));
            setMessages(clientMessages);
          } else {
            console.error("Failed to load conversation:", chatId);
            setMessages([{ id: uuidvv4(), text: 'Failed to load conversation history. Check console for details.', role: 'model', timestamp: new Date() } as ChatMessage]);
          }
        } catch (error) {
          console.error("Error fetching chat history:", error);
        } finally {
          setIsHistoryLoading(false);
        }
      };
      fetchChatHistory();
    } else {
      // New chat state
      setMessages([]);
      setAttachments([]); 
      setIsHistoryLoading(false);
    }
  }, [chatId, user, getIdToken]);

  // --- Utility Functions ---
  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateBotStreamingMessage = useCallback((text: string) => {
    setMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.id === BOT_PENDING_ID) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, text: lastMessage.text + text },
        ];
      }
      return [...prev, { id: BOT_PENDING_ID, text, role: 'model', timestamp: new Date() } as ChatMessage];
    });
  }, []);

  const finalizeBotMessage = useCallback((finalText: string) => {
    setMessages((prev) => {
      const finalIndex = prev.findIndex(m => m.id === BOT_PENDING_ID);
      if (finalIndex !== -1) {
        const finalBotMessage: ChatMessage = {
            id: uuidvv4(), 
            text: finalText,
            role: 'model',
            timestamp: new Date(),
          };
        return [...prev.slice(0, finalIndex), finalBotMessage];
      }
      return prev;
    });
    onNewMessageSent(); // Notify parent to refresh sidebar
  }, [onNewMessageSent]);

  // --- Input and UI Handlers ---
  
  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Stop listening if Enter is pressed
      if (isListening) stopListening();
      handleSendMessage(e as unknown as React.FormEvent);
    }
  };

  type FileEvent = ChangeEvent<HTMLInputElement> | ReactDragEvent<HTMLDivElement> | React.ClipboardEvent<HTMLTextAreaElement>;
  
  const handleFileSelect = (e: FileEvent) => {
      // ... (file selection logic remains the same as in part 1)
      const selectedFiles: File[] = [];
  
      if ('clipboardData' in e) {
          if (e.clipboardData?.files) {
              selectedFiles.push(...Array.from(e.clipboardData.files));
          }
      } else if ('dataTransfer' in e) { // ReactDragEvent<HTMLDivElement>
          if (e.dataTransfer?.files) {
              selectedFiles.push(...Array.from(e.dataTransfer.files));
          }
      } else if ('target' in e && (e.target as HTMLInputElement).files) { // ChangeEvent<HTMLInputElement>
          const target = e.target as HTMLInputElement;
          if (target.files) {
              selectedFiles.push(...Array.from(target.files));
          }
      }
      
      const validFiles: File[] = selectedFiles.filter((file) => 
        (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) && file.size < 20 * 1024 * 1024 // 20MB limit
      );
  
      if (validFiles.length > 0) {
        setAttachments(prev => [...prev, ...validFiles]);
      }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleVoiceInputToggle = () => {
      if (isLoading || isHistoryLoading) return;
      if (isListening) {
          stopListening();
      } else {
          // Clear current text if no attachments exist, otherwise append
          if (attachments.length === 0) {
              setInput('');
          }
          startListening(input);
      }
  };


  // --- Main Send Handler ---

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) stopListening();
    
    const trimmedInput = input.trim();
    
    if ((!trimmedInput && attachments.length === 0) || isLoading || isHistoryLoading) return;

    // 1. Convert attachments to Base64 payload
    const base64Attachments: FileAttachment[] = await Promise.all(
        attachments.map(file => fileToBase64(file))
    );
    
    // Check if the user's current settings include a system prompt to be passed to the API
    const globalSystemPrompt = settings?.globalSystemPrompt;
    const streamingEnabled = settings?.streamingEnabled ?? true; // <-- Get streaming preference
    
    const userMessage: ChatMessage = {
      id: uuidvv4(),
      text: trimmedInput,
      role: 'user',
      timestamp: new Date(),
      files: base64Attachments.length > 0 ? base64Attachments : undefined,
    };

    addMessage(userMessage);
    addMessage({ 
        id: BOT_PENDING_ID, 
        text: '...', 
        role: 'model', 
        timestamp: new Date() 
    } as ChatMessage);
    
    setInput('');
    setAttachments([]); 
    setIsLoading(true);

    try {
      const token = await getIdToken();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, 
        },
        body: JSON.stringify({
          message: trimmedInput,
          chatId: chatId, 
          files: base64Attachments, 
          // Pass the system prompt if this is a NEW chat (API route will use it if chatId is missing)
          globalSystemPrompt: chatId ? undefined : globalSystemPrompt, 
        }),
      });

      if (response.status === 401) {
          finalizeBotMessage('Session expired. Please log out and log back in.');
          return;
      }
      if (!response.ok || !response.body) {
        // Attempt to read error body if available
        let errorMsg = 'Sorry, Big AI ran into an internal error.';
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch {}
        finalizeBotMessage(errorMsg);
        return; 
      }
      
      const newChatId = response.headers.get('X-Chat-ID');
      if (newChatId && newChatId !== chatId) {
          onChatIdChange(newChatId); 
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      // CONDITIONAL STREAMING LOGIC
      if (streamingEnabled) {
          // Streaming/Typing mode (Read chunk by chunk and update UI)
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            accumulatedText += chunk;
            updateBotStreamingMessage(chunk); 
          }
      } else {
          // Instant response mode (Wait for stream to finish reading entirely)
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulatedText += decoder.decode(value);
          }
          // Display the final accumulated text all at once
          updateBotStreamingMessage(accumulatedText);
      }
      
      finalizeBotMessage(accumulatedText);

    } catch (error) {
      console.error('Error fetching AI response:', error);
      finalizeBotMessage('Sorry, Big AI ran into a communication error.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Scroll Anchor Effect
  useEffect(() => {
    if (!isHistoryLoading) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHistoryLoading]);

  // --- Render ---

  if (isHistoryLoading) {
    return (
        <div className="flex flex-col h-full items-center justify-center" style={{backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)'}}>
            <svg className="animate-spin h-8 w-8" style={{color: 'var(--accent-primary)'}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="mt-4">Loading conversation...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full" style={{backgroundColor: 'var(--bg-primary)'}}>
      <header className="p-4 border-b shadow-sm flex justify-between items-center" style={{backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}>
        <h1 className="font-semibold truncate max-w-[calc(100%-80px)]">
            {chatId ? messages[0]?.text.substring(0, 50) + '...' : 'New Conversation'}
        </h1>
        {/* NEW: Conversation Mode Button in Header */}
        <button
            onClick={onOpenConversationMode}
            className="p-2 rounded-lg transition"
            title="Start Conversation Mode (Voice Chat)"
            disabled={isLoading || isHistoryLoading}
            style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)'}}
        >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        </button>
      </header>
      
      {/* Chat Messages Display */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6"
        style={{backgroundColor: 'var(--bg-primary)'}}
        onDrop={(e) => { e.preventDefault(); handleFileSelect(e); }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.boxShadow = `0 0 10px var(--accent-primary)`; }}
        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.boxShadow = 'none'; }}
      >
        {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center h-full text-gray-500' style={{color: 'var(--text-secondary)'}}>
                <h1 className='text-3xl font-bold mb-4' style={{color: 'var(--accent-primary)'}}>Big AI</h1>
                <p>Start a new conversation or drag files here!</p>
            </div>
        )}
        {messages.map((msg, index) => (
          <ChatBubble 
            key={msg.id + index} 
            message={msg} 
            isPending={msg.id === BOT_PENDING_ID} 
          />
        ))}
        {/* Scroll Anchor */}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form Area */}
      <div className="p-4 border-t flex flex-col items-center" style={{backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)'}}>
        
        {/* File Preview Area */}
        {attachments.length > 0 && (
            <div className='w-full max-w-2xl mb-3 flex flex-wrap gap-2 p-3 border rounded-lg' style={{borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)'}}>
                {attachments.map((file, index) => (
                    <div key={index} className='relative flex items-center p-2 rounded-md text-sm' style={{backgroundColor: 'var(--ai-bubble-bg)', color: 'var(--text-primary)'}}>
                        <span className='truncate max-w-[150px]'>{file.name}</span>
                        <button 
                            type="button" 
                            onClick={() => removeAttachment(index)} 
                            className='ml-2 text-red-500 hover:text-red-700'
                        >
                            &times;
                        </button>
                    </div>
                ))}
            </div>
        )}


        <form onSubmit={handleSendMessage} className="flex w-full max-w-2xl border rounded-xl shadow-lg" style={{borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)'}}>
            
            {/* Voice Input Button */}
            {recognitionSupported && (
                <button
                    type="button"
                    onClick={handleVoiceInputToggle}
                    className={`p-3 transition flex items-center justify-center shrink-0 ${isListening ? 'voice-input-active' : ''}`}
                    title={isListening ? "Stop Listening" : "Start Voice Input (STT)"}
                    disabled={isLoading || isHistoryLoading}
                    style={{color: isListening ? 'white' : 'var(--text-secondary)', borderRadius: '0.75rem 0 0 0.75rem'}}
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v0a7 7 0 01-7-7v0a7 7 0 0114 0zM12 18v3m4 0H8m6-12a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                </button>
            )}

            {/* File Upload Button */}
            <label htmlFor="file-upload" className="p-3 text-gray-500 hover:text-blue-500 cursor-pointer flex items-center justify-center shrink-0" style={{color: 'var(--text-secondary)', borderLeft: recognitionSupported ? '1px solid var(--border-color)' : 'none'}}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13.5"></path></svg>
                <input 
                    id="file-upload" 
                    type="file" 
                    multiple 
                    onChange={handleFileSelect as (e: ChangeEvent<HTMLInputElement>) => void}
                    className="hidden" 
                    disabled={isLoading || isHistoryLoading || isListening}
                />
            </label>

            <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handleFileSelect as (e: React.ClipboardEvent<HTMLTextAreaElement>) => void} 
                placeholder={isListening ? "Listening..." : "Message Big AI..."}
                className="flex-1 p-3 bg-transparent focus:outline-none resize-none overflow-y-auto max-h-[200px]"
                style={{ minHeight: '48px', color: 'var(--text-primary)' }}
                disabled={isLoading || isHistoryLoading || isListening}
                rows={1}
                autoFocus
            />
            
            {/* Send Button */}
            <button
              type="submit"
              className="px-4 py-3 text-white rounded-r-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading || isHistoryLoading || isListening || (!input.trim() && attachments.length === 0)}
              style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}} // Use AI text color for contrast on accent background
            >
              <svg className="w-5 h-5 transform rotate-45 -mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
        </form>
      </div>
    </div>
  );
}
