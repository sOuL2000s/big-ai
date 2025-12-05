// components/Sidebar.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
// import { deleteAllUserConversations } from '@/lib/history'; // Assuming we create this function
import SettingsPanel from './SettingsPanel'; // <-- NEW IMPORT

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
    const { user, signOut, getIdToken } = useAuth();
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false); // <-- NEW STATE

    // FIX: Memoize fetchHistory using useCallback to stabilize it as a dependency
    const fetchHistory = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getIdToken();
            const response = await fetch('/api/chats', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            if (response.ok) {
                const data: ChatHistoryItem[] = await response.json();
                setHistory(data);
            }
        } catch (error) {
            console.error("Failed to fetch chat history:", error);
        } finally {
            setLoading(false);
        }
    }, [user, getIdToken]); // Dependencies for useCallback

    useEffect(() => {
        fetchHistory();
    }, [currentChatId, fetchHistory]); // Dependency array now includes fetchHistory

    const handleNewChat = () => {
        onSelectChat(undefined);
    };

    const handleSignOut = async () => {
        if (confirm("Are you sure you want to sign out?")) {
            await signOut();
        }
    };

    const handleDeleteAllChats = async () => {
        if (!user) return;
        if (confirm("DANGER: Are you sure you want to permanently delete ALL your chat history? This cannot be undone.")) {
            // Placeholder/Mock action
            // await deleteAllUserConversations(user.uid); 
            alert("All user chats deleted (Mocked implementation). History sidebar will refresh.");
            setHistory([]);
            onSelectChat(undefined);
        }
    }

    // Updated handler to control the Settings modal
    const handleSettingsAction = (action: string) => {
        if (action === 'Settings') {
            setIsSettingsOpen(true);
        } else if (action === 'Delete All Chats') {
             handleDeleteAllChats();
        }
    };


    return (
        <div className="flex flex-col w-64 bg-gray-900 text-white h-screen p-3 shadow-2xl relative">
            {isSettingsOpen && <SettingsPanel onClose={() => setIsSettingsOpen(false)} />}
            
            {/* Header / New Chat Button */}
            <div className="mb-4">
                <button
                    onClick={handleNewChat}
                    className="flex w-full items-center justify-start gap-2 rounded-lg border border-gray-700 p-3 text-sm transition duration-150 hover:bg-gray-800"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Start New Chat
                </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {loading && <div className="text-gray-500 text-sm p-3">Loading history...</div>}
                
                {history.length === 0 && !loading && (
                    <div className="text-gray-500 text-sm p-3">No history found.</div>
                )}
                
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
                        <svg className="w-4 h-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4M12 4v16"></path></svg>
                        <span className="truncate flex-1">
                            {chat.title}
                        </span>
                    </button>
                ))}
            </div>
            
            {/* Settings and Footer Area */}
            <div className="pt-4 border-t border-gray-700 mt-4 space-y-2">
                 <button 
                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-gray-800 transition text-blue-300"
                    onClick={() => handleSettingsAction('Settings')}
                >
                    <span className="font-semibold">⚙️ Settings & Prompts</span>
                </button>
                
                 <button 
                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-gray-800 transition text-red-300"
                    onClick={() => handleSettingsAction('Delete All Chats')}
                >
                    <span className="font-semibold">🗑️ Delete All Chats (Mock)</span>
                </button>

                <div className="text-sm text-gray-400 border-t border-gray-800 pt-2">
                    {user?.email || "User"}
                </div>
                <button 
                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-red-900 transition text-red-400"
                    onClick={handleSignOut}
                >
                    Log out
                </button>
            </div>
        </div>
    );
}