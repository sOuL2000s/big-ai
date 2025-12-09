// components/Sidebar.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeContext';
import PromptManager from './PromptManager'; 

interface ChatHistoryItem {
    id: string;
    title: string;
    updatedAt: number;
}

interface SidebarProps {
    onSelectChat: (chatId: string | undefined) => void;
    currentChatId: string | undefined;
    onNewMessageSent: () => void; 
    onOpenConversationMode: () => void; 
    isMobileOpen: boolean;
    onCloseMobile: () => void;
    isMobileView: boolean;
}

// Available Models list (Kept the same)
const AVAILABLE_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Stable)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
];

export default function Sidebar({ onSelectChat, currentChatId, onNewMessageSent, onOpenConversationMode, isMobileOpen, onCloseMobile, isMobileView }: SidebarProps) {
    const { user, signOut, getIdToken } = useAuth();
    const { themeName, themeMode, setMode, setTheme, settings, updateSettings, availableThemes } = useTheme();
    
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPromptManagerOpen, setIsPromptManagerOpen] = useState(false); 
    const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(true); 

    const fetchHistory = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const token = await getIdToken();
            const response = await fetch('/api/chats', {
                headers: { 'Authorization': `Bearer ${token}` }
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
    }, [user, getIdToken]); 

    useEffect(() => {
        fetchHistory();
    }, [onNewMessageSent, fetchHistory]); 

    const handleNewChat = () => {
        onSelectChat(undefined);
    };
    
    const handleDeleteChat = async (chatIdToDelete: string) => {
        if (!user) return;
        
        const chatToDelete = history.find(c => c.id === chatIdToDelete);
        const title = chatToDelete?.title || "this chat";

        if (confirm(`Are you sure you want to delete ${title}? This cannot be undone.`)) {
            try {
                const token = await getIdToken();
                const response = await fetch(`/api/chat?chatId=${chatIdToDelete}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    setHistory(prev => prev.filter(c => c.id !== chatIdToDelete));
                    
                    if (currentChatId === chatIdToDelete) {
                        onSelectChat(undefined);
                    }
                    onNewMessageSent();
                } else {
                    console.error("Failed to delete chat:", await response.json());
                    alert("Failed to delete chat. Check console.");
                }
            } catch (error) {
                 console.error("Error deleting chat:", error);
                 alert("Error deleting chat. Check console.");
            }
        }
    }

    const handleSignOut = async () => {
        if (confirm("Are you sure you want to sign out?")) {
            await signOut();
        }
    };
    
    const handleDeleteAllChats = async () => {
        if (!user) return;
        if (confirm("DANGER: Are you sure you want to permanently delete ALL your chat history? This cannot be undone.")) {
            try {
                const token = await getIdToken();
                const response = await fetch('/api/chats', {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    setHistory([]);
                    onSelectChat(undefined);
                } else {
                    console.error('Failed to delete all chats:', await response.json());
                }
            } catch (error) {
                 console.error("Error deleting all chats:", error);
            }
        }
    }

    const handleClearLocalStorage = () => {
        if (confirm('WARNING: Are you sure you want to clear all local settings (themes, model selection)? Your chat history (saved in the cloud) will NOT be affected, but you may need to re-login and re-select your preferred theme.')) {
            localStorage.clear(); 
            window.location.reload(); 
        }
    }
    
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateSettings({ globalModel: e.target.value });
    };

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setTheme(e.target.value);
    };

    const handleModeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMode(e.target.checked ? 'dark' : 'light');
    };
    
    const handleStreamingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings({ streamingEnabled: e.target.checked });
    };


    return (
        // FIX: Use w-full only on mobile for full screen coverage, keep w-64 for desktop.
        // Add shrink-0 to prevent flex shrinkage on desktop.
        <div 
            className={`
                flex flex-col h-screen p-3 shadow-2xl shrink-0 transition-transform duration-300 ease-in-out
                w-64 md:relative md:translate-x-0
                ${isMobileView ? 'fixed z-30 inset-y-0 w-full max-w-[80%]' : ''} 
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
            `} 
            style={{backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-primary)', borderRight: '1px solid var(--sidebar-border)'}}
        >
            
            {isPromptManagerOpen && (
                <PromptManager onClose={() => { setIsPromptManagerOpen(false); onNewMessageSent(); }} />
            )}
            
            <div className="flex items-center justify-between pb-4 border-b mb-4" style={{borderColor: 'var(--sidebar-border)'}}>
                 <h2 className="text-xl font-bold flex items-center gap-2" style={{color: 'var(--text-primary)'}}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: 'var(--accent-primary)'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M4.343 19.657l.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    Big AI
                </h2>
                
                {/* Mobile Close Button */}
                {isMobileView && (
                    <button 
                        onClick={onCloseMobile} 
                        className="p-1 rounded-full hover:bg-[var(--sidebar-item-hover)]"
                        style={{color: 'var(--text-primary)'}}
                    >
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                )}
            </div>
            
            {/* New Chat Button */}
            <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center p-3 rounded-xl font-semibold shadow-lg transition-colors mb-4"
                style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}} 
            >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"></path></svg> 
                Start New Chat
            </button>


            {/* Conversation Mode Button */}
             <button
                onClick={onOpenConversationMode}
                className="w-full flex items-center justify-center p-3 rounded-xl font-semibold transition-colors mb-4"
                style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)'}}
                title="Start Voice Conversation"
            >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Conversation Mode
            </button>


            {/* History List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <h3 className="text-sm font-semibold uppercase sticky top-0 py-1" style={{color: 'var(--text-secondary)', backgroundColor: 'var(--sidebar-bg)'}}>
                    History ({history.length})
                </h3>
                {loading && <div className="text-sm p-3" style={{color: 'var(--text-secondary)'}}>Loading history...</div>}
                
                {history.length === 0 && !loading && (
                    <div className="text-sm p-3" style={{color: 'var(--text-secondary)'}}>No history found.</div>
                )}
                
                {history.map((chat) => (
                    <div 
                        key={chat.id}
                        className={`group flex items-center justify-between p-3 rounded-lg text-sm transition duration-150 ${
                            chat.id === currentChatId 
                                ? 'font-semibold' 
                                : 'hover:opacity-80'
                        }`}
                        style={{
                            backgroundColor: chat.id === currentChatId ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            color: chat.id === currentChatId ? 'var(--ai-bubble-text)' : 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                        title={chat.title}
                    >
                        {/* Title Section (Clickable area to select chat) */}
                        <button
                            onClick={() => onSelectChat(chat.id)}
                            className="flex items-center flex-1 min-w-0 pr-2 text-left"
                            style={{ color: 'inherit', background: 'none', border: 'none', padding: 0 }}
                        >
                            <svg className="w-4 h-4 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4M12 4v16"></path></svg>
                            <span className="truncate flex-1">
                                {chat.title}
                            </span>
                        </button>
                        
                        {/* Delete Button (Visible on hover) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                            className={`p-1 rounded transition ml-2 shrink-0 opacity-0 group-hover:opacity-100`}
                            title="Delete Chat"
                            style={{ 
                                color: chat.id === currentChatId ? 'var(--ai-bubble-text)' : 'var(--accent-error)',
                                backgroundColor: chat.id === currentChatId ? 'var(--accent-primary-hover)' : 'transparent',
                            }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                ))}
            </div>
            
            {/* Footer Area - Collapsible Settings and Auth */}
            <div className="pt-4 border-t mt-4 space-y-2" style={{borderColor: 'var(--sidebar-border)'}}>
                 
                 {/* Settings Toggle Button */}
                 <button 
                    className="w-full flex items-center justify-between p-2 rounded-lg font-semibold transition"
                    onClick={() => setIsSettingsCollapsed(prev => !prev)}
                    style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)'}}
                 >
                    <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: 'var(--accent-primary)'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.942 3.333.9 2.456 2.456a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.942 1.543-.9 3.333-2.456 2.456a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.942-3.333-.9-2.456-2.456a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.942-1.543.9-3.333 2.456-2.456a1.724 1.724 0 002.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Settings
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${isSettingsCollapsed ? 'transform rotate-0' : 'transform rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {/* Collapsible Settings Content */}
                <div className={`space-y-3 overflow-hidden transition-all duration-300 ${isSettingsCollapsed ? 'max-h-0' : 'max-h-[800px]'}`}>

                    {/* Quick Prompt/Template Access */}
                    <button 
                        className="w-full text-left text-sm p-2 rounded-lg transition"
                        onClick={() => { setIsPromptManagerOpen(true); if(isMobileView) onCloseMobile(); }} // Close sidebar when opening manager
                        style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-secondary)'}}
                    >
                        <span className="font-semibold flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-2.414-2.414A1 1 0 0015.586 6H7a2 2 0 00-2 2v11a2 2 0 002 2zM17 17H7m10-4H7m4-4H7"></path></svg>
                             Manage Prompts & API Key
                        </span>
                    </button>

                    {/* Model Selector */}
                    <div>
                        <label className="block text-xs font-medium uppercase mb-1" style={{color: 'var(--text-secondary)'}}>AI Model</label>
                        <select
                            value={settings?.globalModel || AVAILABLE_MODELS[0].id}
                            onChange={handleModelChange}
                            className="w-full p-2 rounded-lg border text-sm"
                            style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                        >
                            {AVAILABLE_MODELS.map(model => (
                                <option key={model.id} value={model.id}>{model.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Theme Selector (Uses the expanded list from ThemeContext) */}
                    <div>
                        <label className="block text-xs font-medium uppercase mb-1" style={{color: 'var(--text-secondary)'}}>Theme</label>
                        <select
                            value={themeName}
                            onChange={handleThemeChange}
                            className="w-full p-2 rounded-lg border text-sm"
                            style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                        >
                            {availableThemes.map(theme => (
                                <option key={theme.id} value={theme.id}>{theme.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Dark/Light Mode Toggle */}
                    <div className="flex items-center justify-between text-sm py-2">
                         <span style={{color: 'var(--text-secondary)'}}>Dark Mode ({themeMode})</span>
                         <label className="relative inline-block w-12 h-6">
                            <input type="checkbox" checked={themeMode === 'dark'} onChange={handleModeToggle} className="opacity-0 w-0 h-0" />
                            <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full before:absolute before:content-[''] before:h-4 before:w-4 before:left-1 before:bottom-1 before:rounded-full transition duration-400" 
                                style={{
                                    backgroundColor: themeMode === 'dark' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    '--tw-translate-x': themeMode === 'dark' ? '24px' : '0',
                                    transition: 'background-color 0.4s, transform 0.4s'
                                } as React.CSSProperties}
                            ></span>
                        </label>
                    </div>

                    {/* Streaming Toggle - Renamed Label */}
                     <div className="flex items-center justify-between text-sm py-2">
                         <span style={{color: 'var(--text-secondary)'}}>AI Response: {settings?.streamingEnabled ? 'Typing (Stream)' : 'Instant (Full)'}</span>
                         <label className="relative inline-block w-12 h-6">
                            <input 
                                type="checkbox" 
                                checked={settings?.streamingEnabled ?? true} 
                                onChange={handleStreamingToggle} 
                                className="opacity-0 w-0 h-0" 
                            />
                            <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full before:absolute before:content-[''] before:h-4 before:w-4 before:left-1 before:bottom-1 before:rounded-full transition duration-400" 
                                style={{
                                    backgroundColor: (settings?.streamingEnabled ?? true) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    '--tw-translate-x': (settings?.streamingEnabled ?? true) ? '24px' : '0',
                                    transition: 'background-color 0.4s, transform 0.4s'
                                } as React.CSSProperties}
                            ></span>
                        </label>
                    </div>


                    {/* Data Management Buttons */}
                    <div className="pt-3 border-t space-y-2" style={{borderColor: 'var(--sidebar-border)'}}>
                        <button 
                            className="w-full text-left text-sm p-2 rounded-lg transition"
                            onClick={handleDeleteAllChats}
                            style={{backgroundColor: 'var(--accent-error)', color: 'white'}}
                        >
                            <span className="font-semibold flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Delete All Chats
                            </span>
                        </button>
                        <button 
                            className="w-full text-left text-sm p-2 rounded-lg transition"
                            onClick={handleClearLocalStorage}
                            style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)'}}
                        >
                            <span className="font-semibold flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10m0 0h16M4 17l4-4m-4 4l4 4M20 7v10m0 0H4m16 0l-4-4m4 4l-4 4M12 5v14"></path></svg>
                                Clear Local Cache
                            </span>
                        </button>
                    </div>
                </div>

                {/* Authentication Status */}
                <div className="text-sm border-t pt-4 mt-4" style={{color: 'var(--text-secondary)', borderColor: 'var(--sidebar-border)'}}>
                    <div className="truncate mb-2" style={{color: 'var(--text-primary)'}}>
                         Logged in as: {user?.email || "User"}
                    </div>
                </div>
                <button 
                    className="w-full text-left text-sm p-2 rounded-lg transition hover:bg-red-900/50"
                    onClick={handleSignOut}
                    style={{backgroundColor: 'var(--bg-secondary)', color: 'var(--accent-error)'}}
                >
                    Log out
                </button>
            </div>
        </div>
    );
}