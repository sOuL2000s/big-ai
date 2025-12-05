// components/ChatArea.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ChatMessage, Conversation } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

const BOT_PENDING_ID = 'bot-pending';

interface ChatAreaProps {
    chatId: string | undefined;
    onChatIdChange: (newChatId: string) => void;
    onNewMessageSent: () => void; // Trigger sidebar refresh
}

export default function ChatArea({ chatId, onChatIdChange, onNewMessageSent }: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // --- History Loading Effect ---
  useEffect(() => {
    if (chatId) {
      setIsHistoryLoading(true);
      setMessages([]); // Clear old messages
      
      const fetchChatHistory = async () => {
        try {
          const response = await fetch(`/api/chat?chatId=${chatId}`);
          if (response.ok) {
            const conversation: Conversation = await response.json();
            // Ensure timestamps are correctly converted back to Date objects for the client
            const clientMessages: ChatMessage[] = conversation.messages.map(m => ({
                ...m,
                timestamp: new Date(m.timestamp),
            }));
            setMessages(clientMessages);
          } else {
            console.error("Failed to load conversation:", chatId);
            setMessages([{ id: uuidv4(), text: 'Failed to load conversation history.', role: 'model', timestamp: new Date() }]);
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
      setIsHistoryLoading(false);
    }
  }, [chatId]);

  // --- Utility Functions (Same as before) ---
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
          id: uuidv4(), 
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

  // --- Main Send Handler ---

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || isHistoryLoading) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      text: trimmedInput,
      role: 'user',
      timestamp: new Date(),
    };

    addMessage(userMessage);
    addMessage({ 
        id: BOT_PENDING_ID, 
        text: '', // Start with empty text for streaming feel
        role: 'model', 
        timestamp: new Date() 
    } as ChatMessage);
    
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedInput,
          chatId: chatId, 
        }),
      });

      if (!response.ok || !response.body) {
        finalizeBotMessage('Sorry, Big AI ran into an error.');
        throw new Error('Network response was not ok');
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

  const chatEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait until loading is done before smooth scrolling
    if (!isHistoryLoading) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHistoryLoading]);

  // --- Render ---

  if (isHistoryLoading) {
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-gray-800">
        {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400'>
                <h1 className='text-3xl font-bold mb-4'>Big AI</h1>
                <p>Start a new conversation!</p>
            </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={msg.id + index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="flex items-start max-w-[75%]">
                {msg.role === 'model' && (
                     <div className='p-2 rounded-full bg-blue-600 text-white mr-3'>
                        AI
                     </div>
                )}
                <div
                    className={`p-3 rounded-lg shadow-md whitespace-pre-wrap transition duration-300 ease-in-out ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-bl-none'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tr-none border dark:border-gray-600'
                    } ${msg.id === BOT_PENDING_ID ? 'animate-pulse text-gray-400 dark:text-gray-500 border-dashed' : ''}`}
                >
                  <p>{msg.text}</p>
                </div>
                {msg.role === 'user' && (
                     <div className='p-2 rounded-full bg-gray-500 text-white ml-3'>
                        You
                     </div>
                )}
            </div>
          </div>
        ))}
        {/* Scroll Anchor */}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-center">
        <div className="flex w-full max-w-2xl border dark:border-gray-600 rounded-xl shadow-lg">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isLoading ? "Please wait..." : "Message Big AI..."}
              className="flex-1 p-3 bg-transparent rounded-l-xl focus:outline-none text-gray-900 dark:text-gray-200"
              disabled={isLoading || isHistoryLoading}
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-3 bg-blue-600 text-white rounded-r-xl hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading || isHistoryLoading || !input.trim()}
            >
              <svg className="w-5 h-5 transform rotate-45 -mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
        </div>
      </form>
    </div>
  );
}