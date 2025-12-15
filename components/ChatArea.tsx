// components/ChatArea.tsx
'use client';

import React, { useState, useCallback, useEffect, useRef, ChangeEvent, DragEvent as ReactDragEvent, KeyboardEvent, useMemo } from 'react';
import { ChatMessage, Conversation, FileAttachment } from '@/types/chat';
import ChatBubble from './ChatBubble'; 
import { useAuth } from '@/components/providers/AuthProvider';
import { v4 as uuidvv4 } from 'uuid';
import { useTheme } from '@/components/providers/ThemeContext';
import useSpeechRecognition from '@/hooks/useSpeechRecognition';

const BOT_PENDING_ID = 'bot-pending';

interface ChatAreaProps {
    chatId: string | undefined;
    onChatIdChange: (newChatId: string) => void;
    onNewMessageSent: () => void;
    onOpenConversationMode: () => void;
    onToggleSidebar: () => void;
    isMobileView: boolean;
}

// Utility to convert file to Base64 (kept unchanged)
const fileToBase64 = (file: File): Promise<FileAttachment> => {
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


export default function ChatArea({ 
    chatId, 
    onChatIdChange, 
    onNewMessageSent, 
    onOpenConversationMode, 
    onToggleSidebar, 
    isMobileView 
}: ChatAreaProps) {
  const { user, getIdToken } = useAuth();
  const { settings } = useTheme();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typedInput, setTypedInput] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]); 
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const [isInitialExchange, setIsInitialExchange] = useState(false); 
  
  const initialSpeechInputRef = useRef('');


  // --- Message/Input Utilities (Hoisted for use in useCallback definitions) ---
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
    if (!finalText.startsWith('Error') && !finalText.startsWith('Sorry, Big AI ran into an internal error.')) {
        onNewMessageSent(); 
    }
  }, [onNewMessageSent]);


  // === Voice Recognition Hook Callbacks ===
  
  // NOTE: We rely on the hook returning the current transcript state (`transcript`) live.

  const handleFinalTranscript = useCallback((finalTranscript: string) => {
      // Merge the final transcript into typedInput
      const finalMessage = (initialSpeechInputRef.current + ' ' + finalTranscript).trim();
      setTypedInput(finalMessage);
      initialSpeechInputRef.current = finalMessage; 
  }, []); 

  const handleSpeechStart = useCallback(() => {
      // Store the current text that was in the box
      const currentInput = typedInput.trim();
      initialSpeechInputRef.current = currentInput;
      
      // CRITICAL FIX: Ensure typedInput is set to the current base input to ensure 
      // the initial view (mergedInput) correctly shows the existing text + live speech
      // when the speech starts. If the current input is empty, clear the state.
      if (!currentInput) {
           setTypedInput('');
      } else {
           // If there's text, we let initialSpeechInputRef hold it, and `transcript` 
           // will start showing new spoken words.
      }
  }, [typedInput]); 

  const handleSpeechEnd = useCallback(() => {
      inputRef.current?.focus();
  }, []); 
  
  // Need to use inputRef's current value to capture the merged state before erroring/stopping
  const handleSpeechError = useCallback((error: string) => {
      console.error("STT Error:", error);
      if (error.includes('not-allowed')) {
          alert("Microphone access denied. Please allow microphone access.");
      } 
      
      // CRITICAL FIX: On error, immediately finalize the text based on what is visually in the box
      const currentLiveInput = inputRef.current?.value || typedInput;
      setTypedInput(currentLiveInput);
      initialSpeechInputRef.current = currentLiveInput;
  }, [typedInput]); 


  // --- Wrap the options object in useMemo ---
  const recognitionOptions = useMemo(() => ({
      continuous: true, 
      onFinalTranscript: handleFinalTranscript,
      onStart: handleSpeechStart,
      onEnd: handleSpeechEnd,
      onError: handleSpeechError,
  }), [handleFinalTranscript, handleSpeechStart, handleSpeechEnd, handleSpeechError]);

  // === Voice Recognition Hook Integration ===
  const { 
      isListening, 
      transcript, 
      startListening, 
      stopListening, 
      recognitionSupported,
  } = useSpeechRecognition(recognitionOptions);


  // Calculate the live input value: typed text + live transcript (if listening)
  // This value is computed on every render based on mutable ref and state.
  const mergedInput = isListening 
    ? (initialSpeechInputRef.current + ' ' + transcript).trim()
    : typedInput;


  // --- History Loading Effect (unchanged) ---
  useEffect(() => {
    if (!user) return;
    // ... (unchanged history loading logic) ...
    if (chatId) {
      if (isInitialExchange) {
        setIsInitialExchange(false); 
        setIsHistoryLoading(false);
        return; 
      }
        
      setIsHistoryLoading(true);
      setMessages([]); 
      
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
            let errorMsg = 'Failed to load conversation history.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
                if (errorData.details) {
                    errorMsg += `\n\n--- Debug Details ---\n${errorData.details}`;
                }
            } catch {}
            console.error("Failed to load conversation:", errorMsg);
            setMessages([{ id: uuidvv4(), text: `Error loading history: ${errorMsg}`, role: 'model', timestamp: new Date() } as ChatMessage]);
          }
        } catch (error) {
          console.error("Error fetching chat history:", error);
           setMessages([{ id: uuidvv4(), text: `Error fetching history: Network connection failed.`, role: 'model', timestamp: new Date() } as ChatMessage]);
        } finally {
          setIsHistoryLoading(false);
        }
      };
      fetchChatHistory();
    } else {
      setMessages([]);
      setAttachments([]); 
      setIsHistoryLoading(false);
    }
  }, [chatId, user, getIdToken, isInitialExchange]); 
  
  
  // === Input and UI Handlers ===
  
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      
      if (isListening) {
          stopListening();
          // The new value from the manual typing action should be captured by typedInput
          // after stopListening runs its sync callback (handleFinalTranscript).
      } 
      setTypedInput(newValue);
  };
  
  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isListening) stopListening();
      handleSendMessage(e as unknown as React.FormEvent);
    }
  };

  type FileEvent = ChangeEvent<HTMLInputElement> | ReactDragEvent<HTMLDivElement> | React.ClipboardEvent<HTMLTextAreaElement>;
  
  const handleFileSelect = (e: FileEvent) => {
      const selectedFiles: File[] = [];
  
      if ('clipboardData' in e) {
          if (e.clipboardData?.files) {
              selectedFiles.push(...Array.from(e.clipboardData.files));
          }
      } else if ('dataTransfer' in e) {
          if (e.dataTransfer?.files) {
              selectedFiles.push(...Array.from(e.dataTransfer.files));
          }
      } else if ('target' in e && (e.target as HTMLInputElement).files) { 
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
          startListening(typedInput);
      }
  };


  // --- Main Send Handler ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Ensure listening stops and the text state is finalized.
    if (isListening) {
        stopListening();
    }
    
    // Wait for the next tick to ensure state synchronization after stopListening
    // Although the hook is synchronous, this protects against React batching issues.
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // 2. Read the final state of typedInput
    const trimmedInput = typedInput.trim(); 
    
    if ((!trimmedInput && attachments.length === 0) || isLoading || isHistoryLoading) return;
    
    // 3. Reset state before sending
    setTypedInput('');
    initialSpeechInputRef.current = '';
    
    // 4. Convert attachments to Base64 payload
    const base64Attachments: FileAttachment[] = await Promise.all(
        attachments.map(file => fileToBase64(file))
    );
    
    const globalSystemPrompt = settings?.globalSystemPrompt;
    const streamingEnabled = settings?.streamingEnabled ?? true; 
    
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
          globalSystemPrompt: chatId ? undefined : globalSystemPrompt, 
        }),
      });

      if (response.status === 401) {
          finalizeBotMessage('Session expired. Please log out and log back in.');
          return;
      }
      
      if (!response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
        let errorMsg = 'Sorry, Big AI ran into an internal error.';
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || `Server responded with status ${response.status}.`;
            if (errorData.details) {
                 errorMsg += `\n\n--- Debug Details ---\n${errorData.details}`;
            }
        } catch (_jsonError) {
             errorMsg = `Server responded with status ${response.status}. Could not read error details.`;
        }
        finalizeBotMessage(`Error: ${errorMsg}`);
        return; 
      }
      
      if (!response.body) {
          finalizeBotMessage('Error: Response body missing from successful stream connection.');
          return;
      }


      const newChatId = response.headers.get('X-Chat-ID');
      if (newChatId && newChatId !== chatId) {
          setIsInitialExchange(true); 
          onChatIdChange(newChatId); 
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      // CONDITIONAL STREAMING LOGIC
      if (streamingEnabled) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            accumulatedText += chunk;
            updateBotStreamingMessage(chunk); 
          }
      } else {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulatedText += decoder.decode(value);
          }
          updateBotStreamingMessage(accumulatedText);
      }
      
      finalizeBotMessage(accumulatedText);

    } catch (error) {
      console.error('Error fetching AI response:', error);
      finalizeBotMessage(`Error fetching AI response: Network or communication failed.`);
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

  // Dynamic Input Height Adjustment (using mergedInput)
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.value = mergedInput;
      textarea.style.height = 'auto'; 
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [mergedInput]);


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
        
        {/* === SIDEBAR TOGGLE BUTTON === */}
        <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg transition mr-2"
            title="Toggle Sidebar"
            disabled={isLoading || isHistoryLoading}
            style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)'}}
        >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7"></path></svg>
        </button>

        <h1 className="font-semibold truncate max-w-[calc(100%-80px)]">
            {chatId ? messages[0]?.text.substring(0, 50) + '...' : 'New Conversation'}
        </h1>
        
        {/* Conversation Mode Button in Header */}
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
                value={mergedInput} 
                onChange={handleInputChange} 
                onKeyDown={handleKeyPress}
                onPaste={handleFileSelect as (e: React.ClipboardEvent<HTMLTextAreaElement>) => void} 
                placeholder={isListening ? "Listening..." : "Message Big AI..."}
                className="flex-1 p-3 bg-transparent focus:outline-none resize-none overflow-y-auto max-h-[200px]"
                style={{ minHeight: '48px', color: 'var(--text-primary)' }}
                disabled={isLoading || isHistoryLoading} 
                rows={1}
                autoFocus
            />
            
            {/* Send Button */}
            <button
              type="submit"
              className="px-4 py-3 text-white rounded-r-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading || isHistoryLoading || (!mergedInput.trim() && attachments.length === 0)} 
              style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}} 
            >
              <svg className="w-5 h-5 transform rotate-45 -mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
        </form>
      </div>
    </div>
  );
}