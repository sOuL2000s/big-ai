// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ChatArea from '@/components/ChatArea';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/providers/AuthProvider';
import AuthGate from '@/components/ui/AuthGate';
import ConversationModeOverlay from '@/components/ConversationModeOverlay';
import { useTheme } from '@/components/providers/ThemeContext';

// Helper function to determine initial mobile state
const getInitialMobileState = () => {
    if (typeof window === 'undefined') {
        // Default to false (desktop mode) during SSR
        return false;
    }
    return window.innerWidth < 768;
};

// Helper function to determine initial sidebar state
const getInitialSidebarState = () => {
    // If not mobile, sidebar should be open by default
    return !getInitialMobileState();
};


export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { loadingSettings } = useTheme();

  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [refreshSidebarToggle, setRefreshSidebarToggle] = useState(false);
  const [isConversationModeOpen, setIsConversationModeOpen] = useState(false);
  
  // === RESPONSIVENESS STATE ===
  // FIX: Initialize state based on the initial check function
  const [isMobile, setIsMobile] = useState(getInitialMobileState());
  const [isSidebarOpen, setIsSidebarOpen] = useState(getInitialSidebarState()); 

  // Effect to handle RENDER-TIME RESIZE events only
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768; 
      
      // Only call setIsMobile if the state actually changes (mobile/desktop boundary crossed)
      setIsMobile(prevMobile => {
          if (prevMobile !== mobile) {
              return mobile;
          }
          return prevMobile;
      });
      
      // Logic for desktop: if resized to desktop, ensure sidebar is open
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true); 
      }
      // Note: We don't need to explicitly close on mobile resize here, 
      // as the initial state already handles the default closed state, 
      // and user input drives mobile collapse/expand.
    };

    window.addEventListener('resize', handleResize);
    // Initial check is now handled by useState initializers, no need for handleResize() here.

    return () => window.removeEventListener('resize', handleResize);
  }, []); 
  // ===================================

  const handleSelectChat = (chatId: string | undefined) => {
    setCurrentChatId(chatId);
    if (isConversationModeOpen) setIsConversationModeOpen(false);
    
    // Close sidebar on mobile when a chat is selected
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
    <div className="flex h-screen overflow-hidden relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      
      {/* 1. Sidebar */}
      <Sidebar 
        onSelectChat={handleSelectChat} 
        currentChatId={currentChatId}
        onNewMessageSent={handleNewMessageSent}
        onOpenConversationMode={() => { 
            setIsConversationModeOpen(true); 
            if (isMobile) setIsSidebarOpen(false);
        }} 
        key={refreshSidebarToggle.toString()} 
        
        isSidebarOpen={isSidebarOpen} 
        onCloseSidebar={() => setIsSidebarOpen(false)} 
        isMobileView={isMobile}
      />
      
      {/* 2. Main Chat Area */}
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