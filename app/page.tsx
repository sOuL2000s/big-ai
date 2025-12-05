// app/page.tsx
'use client';

import { useState } from 'react';
import ChatArea from '@/components/ChatArea';
import Sidebar from '@/components/Sidebar';

export default function HomePage() {
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [refreshSidebarToggle, setRefreshSidebarToggle] = useState(false);

  const handleSelectChat = (chatId: string | undefined) => {
    setCurrentChatId(chatId);
  };
  
  const handleNewMessageSent = () => {
    // Toggle state to force Sidebar to re-fetch history
    setRefreshSidebarToggle(prev => !prev);
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-800">
      {/* 1. Sidebar */}
      <Sidebar 
        onSelectChat={handleSelectChat} 
        currentChatId={currentChatId}
        key={refreshSidebarToggle.toString()} // Force remount/refresh when a new message is sent
      />
      
      {/* 2. Main Chat Area */}
      <main className="flex-1 flex flex-col">
        <ChatArea 
          chatId={currentChatId}
          onChatIdChange={setCurrentChatId}
          onNewMessageSent={handleNewMessageSent}
        />
      </main>
    </div>
  );
}