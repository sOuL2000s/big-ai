// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ChatArea from '@/components/ChatArea';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/providers/AuthProvider';
import AuthGate from '@/components/ui/AuthGate';
import ConversationModeOverlay from '@/components/ConversationModeOverlay';
import { useTheme } from '@/components/providers/ThemeContext';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { loadingSettings } = useTheme();

  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [refreshSidebarToggle, setRefreshSidebarToggle] = useState(false);
  const [isConversationModeOpen, setIsConversationModeOpen] = useState(false);
  
  // === NEW RESPONSIVENESS STATE ===
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to CLOSED on mobile
  const [isMobile, setIsMobile] = useState(false);

  // Effect to determine screen size and manage sidebar visibility default
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768; 
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true); // Always open sidebar on desktop
      } else {
        // If resized to mobile, close the sidebar unless it was already open manually
        setIsSidebarOpen(false); 
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []); 
  // ===================================

  const handleSelectChat = (chatId: string | undefined) => {
    setCurrentChatId(chatId);
    if (isConversationModeOpen) setIsConversationModeOpen(false);
    
    if (isMobile) setIsSidebarOpen(false); 
  };
  
  const handleNewMessageSent = () => {
    setRefreshSidebarToggle(prev => !prev);
  }

  if (authLoading || loadingSettings) {
    return <div className="flex h-screen items-center justify-center text-xl" style={{color: 'var(--text-primary)'}}>Loading application...</div>
  }

  if (!user) {
    return <AuthGate />;
  }

  // Main application view
  return (
    // FIX: Ensure the main container is hidden overflow to prevent scroll issues
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      
      {/* 2. Main Chat Area - This needs to take up all space */}
      {/* On desktop (md:), it takes remaining flex space. On mobile, it takes full width/height. */}
      <main className="flex-1 flex flex-col min-w-0 w-full h-full"> 
        <ChatArea 
          chatId={currentChatId}
          onChatIdChange={setCurrentChatId}
          onNewMessageSent={handleNewMessageSent}
          onOpenConversationMode={() => setIsConversationModeOpen(true)}
          
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          isMobileView={isMobile}
        />
      </main>
      
      {/* 1. Sidebar - Rendered on top of main content on mobile */}
      <Sidebar 
        onSelectChat={handleSelectChat} 
        currentChatId={currentChatId}
        onNewMessageSent={handleNewMessageSent}
        onOpenConversationMode={() => { 
            setIsConversationModeOpen(true); 
            if (isMobile) setIsSidebarOpen(false);
        }} 
        key={refreshSidebarToggle.toString()} 
        
        isMobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        isMobileView={isMobile}
      />
      
      {/* 3. Mobile Overlay Backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* 4. Conversation Mode Overlay */}
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