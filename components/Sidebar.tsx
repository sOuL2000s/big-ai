// components/Sidebar.tsx
'use client';

import React, { useState, useEffect } from 'react';

interface ChatHistoryItem {
    id: string;
    title: string;
    updatedAt: number;
}

interface SidebarProps {
    onSelectChat: (chatId: string | undefined) => void;
    currentChatId: string | undefined;
}

export default function Sidebar({ onSelectChat, currentChatId }: SidebarProps) {
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const response = await fetch('/api/chats');
            if (response.ok) {
                const data: ChatHistoryItem[] = await response.json();
                setHistory(data);
            }
        } catch (error) {
            console.error("Failed to fetch chat history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [currentChatId]); // Refetch history whenever a new chat is created/updated

    const handleNewChat = () => {
        onSelectChat(undefined);
    };

    return (
        <div className="flex flex-col w-64 bg-gray-900 text-white h-screen p-3 shadow-2xl">
            {/* Header / New Chat Button */}
            <div className="mb-4">
                <button
                    onClick={handleNewChat}
                    className="flex w-full items-center justify-start gap-2 rounded-lg border border-gray-700 p-3 text-sm transition duration-150 hover:bg-gray-800"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    New Chat
                </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loading && <div className="text-gray-500 text-sm">Loading history...</div>}
                
                {history.map((chat) => (
                    <button
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={`flex w-full items-center rounded-lg p-3 text-left text-sm transition duration-150 ${
                            chat.id === currentChatId 
                                ? 'bg-gray-700 font-semibold' 
                                : 'hover:bg-gray-800'
                        }`}
                        title={chat.title}
                    >
                        {/* Use a simple chat icon */}
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4M12 4v16"></path></svg>
                        
                        {/* Truncate long titles */}
                        <span className="truncate flex-1">
                            {chat.title}
                        </span>
                    </button>
                ))}
            </div>
            
            {/* Footer/User Info Area */}
            <div className="pt-4 border-t border-gray-700 mt-4">
                <div className="text-sm text-gray-400">
                    Mock User
                </div>
                <button 
                    className="w-full text-left text-sm mt-1 p-2 rounded-lg hover:bg-gray-800 transition"
                    onClick={() => alert("Logout functionality pending.")}
                >
                    Log out
                </button>
            </div>
        </div>
    );
}