// app/page.tsx
'use client';

import { useState } from 'react';
import ChatArea from '@/components/ChatArea';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/providers/AuthProvider';
import AuthGate from '@/components/ui/AuthGate';
import ConversationModeOverlay from '@/components/ConversationModeOverlay'; // NEW IMPORT
import { useTheme } from '@/components/providers/ThemeContext'; // NEW IMPORT

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { loadingSettings } = useTheme(); // Wait for settings/theme to load
  
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [refreshSidebarToggle, setRefreshSidebarToggle] = useState(false);
  
  // NEW STATE: Conversation Mode
  const [isConversationModeOpen, setIsConversationModeOpen] = useState(false);

  const handleSelectChat = (chatId: string | undefined) => {
    setCurrentChatId(chatId);
    // If conversation mode is open, close it upon switching chats
    if (isConversationModeOpen) setIsConversationModeOpen(false);
  };
  
  const handleNewMessageSent = () => {
    // Toggle state to force Sidebar to re-fetch history
    setRefreshSidebarToggle(prev => !prev);
  }

  // Show loading state if authentication or settings/theme is in progress
  if (authLoading || loadingSettings) {
    return <div className="flex h-screen items-center justify-center text-xl" style={{color: 'var(--text-primary)'}}>Loading application...</div>
  }

  // Show AuthGate if user is not logged in
  if (!user) {
    return <AuthGate />;
  }

  // Main application view
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 1. Sidebar */}
      <Sidebar 
        onSelectChat={handleSelectChat} 
        currentChatId={currentChatId}
        onNewMessageSent={handleNewMessageSent} // Allow sidebar to trigger refresh from settings panel saves
        onOpenConversationMode={() => setIsConversationModeOpen(true)} // Pass handler
        key={refreshSidebarToggle.toString()} // Force remount/refresh when a new message is sent
      />
      
      {/* 2. Main Chat Area */}
      <main className="flex-1 flex flex-col">
        <ChatArea 
          chatId={currentChatId}
          onChatIdChange={setCurrentChatId}
          onNewMessageSent={handleNewMessageSent}
          onOpenConversationMode={() => setIsConversationModeOpen(true)} // Pass handler
        />
      </main>
      
      {/* 3. Conversation Mode Overlay */}
      {isConversationModeOpen && (
        <ConversationModeOverlay
          chatId={currentChatId}
          onChatIdChange={setCurrentChatId}
          onClose={() => setIsConversationModeOpen(false)}
          onNewMessageSent={handleNewMessageSent}
        />
      )}
    </div>
  );
}