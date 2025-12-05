// components/ChatArea.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef, ChangeEvent, DragEvent as ReactDragEvent, KeyboardEvent } from 'react';
import { ChatMessage, Conversation, FileAttachment } from '@/types/chat';
import ChatBubble from './ChatBubble'; // NEW: Dedicated component for message rendering
import { useAuth } from '@/components/providers/AuthProvider';
import { v4 as uuidvv4 } from 'uuid';

const BOT_PENDING_ID = 'bot-pending';

interface ChatAreaProps {
    chatId: string | undefined;
    onChatIdChange: (newChatId: string) => void;
    onNewMessageSent: () => void; // Trigger sidebar refresh
}

// Utility to convert file to Base64 (required for Gemini multimodal input)
const fileToBase64 = (file: File): Promise<FileAttachment> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // FIX: Remove unused 'metadata' variable
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


export default function ChatArea({ chatId, onChatIdChange, onNewMessageSent }: ChatAreaProps) {
  const { user, getIdToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]); // New: Files selected by user
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // --- History Loading Effect ---
  useEffect(() => {
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
      setAttachments([]); // Clear attachments for new chat
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
  
  // Dynamic Input Height Adjustment (requested feature)
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; 
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [input]);

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // FIX: Cast e to React.FormEvent<HTMLFormElement> for handleSendMessage
      handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  // FIX: Consolidated and strongly typed the event parameter
  type FileEvent = ChangeEvent<HTMLInputElement> | ReactDragEvent<HTMLDivElement> | React.ClipboardEvent<HTMLTextAreaElement>;
  
  const handleFileSelect = (e: FileEvent) => {
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
      
      // FIX: 'file' is of type 'unknown' -> Map selectedFiles (which are File objects) to File type
      const validFiles: File[] = selectedFiles.filter((file) => 
        (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) && file.size < 20 * 1024 * 1024 // 20MB limit
      );
  
      if (validFiles.length > 0) {
        // FIX: Ensure setState type consistency
        setAttachments(prev => [...prev, ...validFiles]);
      }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };


  // --- Main Send Handler ---

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    
    // Must have text OR attachments
    if ((!trimmedInput && attachments.length === 0) || isLoading || isHistoryLoading) return;

    // 1. Convert attachments to Base64 payload
    const base64Attachments: FileAttachment[] = await Promise.all(
        attachments.map(file => fileToBase64(file))
    );
    
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
        text: '...', // Use '...' as placeholder for pending message/typing indicator
        role: 'model', 
        timestamp: new Date() 
    } as ChatMessage);
    
    setInput('');
    setAttachments([]); // Clear attachments after sending
    setIsLoading(true);

    try {
      const token = await getIdToken();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Send Auth Token
        },
        body: JSON.stringify({
          message: trimmedInput,
          chatId: chatId, 
          files: base64Attachments, // Pass Base64 files to API
        }),
      });

      if (response.status === 401) {
          finalizeBotMessage('Session expired. Please log out and log back in.');
          return;
      }
      if (!response.ok || !response.body) {
        finalizeBotMessage('Sorry, Big AI ran into an internal error.');
        // FIX: Don't throw, just exit the function after finalizing the message
        return; 
      }
      
      const newChatId = response.headers.get('X-Chat-ID');
      if (newChatId && newChatId !== chatId) {
          onChatIdChange(newChatId); // Update conversation ID in parent state
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedText += chunk;
        updateBotStreamingMessage(chunk); 
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
    // ... loading spinner unchanged
    return (
        <div className="flex flex-col h-full items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="mt-4">Loading conversation...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      <header className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center font-semibold shadow-sm">
        {chatId ? messages[0]?.text.substring(0, 50) + '...' : 'New Conversation'}
      </header>
      
      {/* Chat Messages Display */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-gray-800"
        onDrop={(e) => { e.preventDefault(); handleFileSelect(e); }}
        onDragOver={(e) => e.preventDefault()}
      >
        {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400'>
                <h1 className='text-3xl font-bold mb-4'>Big AI</h1>
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
      <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col items-center">
        
        {/* File Preview Area */}
        {attachments.length > 0 && (
            <div className='w-full max-w-2xl mb-3 flex flex-wrap gap-2 p-3 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50'>
                {attachments.map((file, index) => (
                    <div key={index} className='relative flex items-center bg-gray-200 dark:bg-gray-800 p-2 rounded-md text-sm text-gray-800 dark:text-gray-200'>
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


        <form onSubmit={handleSendMessage} className="flex w-full max-w-2xl border dark:border-gray-600 rounded-xl shadow-lg">
            
            {/* File Upload Button */}
            <label htmlFor="file-upload" className="p-3 text-gray-500 dark:text-gray-400 hover:text-blue-500 cursor-pointer flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13.5"></path></svg>
                <input 
                    id="file-upload" 
                    type="file" 
                    multiple 
                    onChange={handleFileSelect as (e: ChangeEvent<HTMLInputElement>) => void} // Explicit ChangeEvent typing
                    className="hidden" 
                    disabled={isLoading || isHistoryLoading}
                />
            </label>

            <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handleFileSelect as (e: React.ClipboardEvent<HTMLTextAreaElement>) => void} // Explicit ClipboardEvent typing
                placeholder={isLoading ? "Please wait..." : (attachments.length > 0 ? `Message Big AI about ${attachments.length} files...` : "Message Big AI...")}
                className="flex-1 p-3 bg-transparent focus:outline-none text-gray-900 dark:text-gray-200 resize-none overflow-y-auto max-h-[200px]"
                disabled={isLoading || isHistoryLoading}
                rows={1}
                style={{ minHeight: '48px' }}
                autoFocus
            />
            
            {/* Send Button */}
            <button
              type="submit"
              className="px-4 py-3 bg-blue-600 text-white rounded-r-xl hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading || isHistoryLoading || (!input.trim() && attachments.length === 0)}
            >
              <svg className="w-5 h-5 transform rotate-45 -mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
        </form>
      </div>
    </div>
  );
}