// components/providers/ThemeContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { UserSettings } from '@/types/chat';

interface ThemeContextType {
  themeName: string;
  themeMode: 'light' | 'dark';
  currentTheme: string; // themeName-themeMode
  settings: UserSettings | null;
  setTheme: (name: string) => void;
  setMode: (mode: 'light' | 'dark') => void;
  updateSettings: (partialSettings: Partial<UserSettings>) => Promise<void>;
  loadingSettings: boolean;
  availableThemes: { id: string; name: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Define available themes based on globals.css integration
const THEMES = [
    { id: 'default', name: 'Small AI v2 (Default)' },
    { id: 'celestial-horizon', name: 'Celestial Horizon' },
    { id: 'verdant-calm', name: 'Verdant Calm' },
    { id: 'cybernetic-pulse', name: 'Cybernetic Pulse' },
    { id: 'urban-pulse', name: 'Urban Pulse' },
    { id: 'rustic-ember', name: 'Rustic Ember' },
    { id: 'neon-mirage', name: 'Neon Mirage' },
    { id: 'ivory-bloom', name: 'Ivory Bloom' },
    { id: 'obsidian-night', name: 'Obsidian Night' },
    { id: 'solar-dawn', name: 'Solar Dawn' },
    { id: 'aurora-drift', name: 'Aurora Drift' },
    { id: 'timeless-echo', name: 'Timeless Echo' },
    { id: 'mystic-void', name: 'Mystic Void' },
    { id: 'darkest-bw', name: 'The Darkest Night' },
    { id: 'coder', name: "Coder's Theme" },
    { id: 'cyberpunk', name: 'Cyberpunk Neon' },
    { id: 'matrix', name: 'Matrix Code' },
    { id: 'solarized', name: 'Solarized' },
    { id: 'dracula', name: 'Dracula' },
    { id: 'monokai', name: 'Monokai Pro' },
    { id: 'nord', name: 'Nord' },
    { id: 'gruvbox', name: 'Gruvbox' },
    { id: 'catppuccin', name: 'Catppuccin' },
    { id: 'cosmic-nexus', name: 'Cosmic Nexus' },
    { id: 'starship-minimal', name: 'Starship Minimal' },
    { id: 'offbeat-cosmic', name: 'Offbeat Cosmic Pastels' },
];

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [themeName, setThemeName] = useState<string>('default');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const currentTheme = `${themeName}-${themeMode}`;

  // --- Persistence & Fetching ---

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoadingSettings(false);
      return;
    }

    try {
      const token = await getIdToken();
      const response = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data: UserSettings = await response.json();
        setSettings(data);
        setThemeName(data.themeName || 'default');
        setThemeMode(data.themeMode || 'dark');
      } else {
        console.error("Failed to fetch user settings.");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  }, [user, getIdToken]);

  const saveSettingsToDB = useCallback(async (partialSettings: Partial<UserSettings>) => {
    if (!user) return;
    try {
      const token = await getIdToken();
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(partialSettings),
      });
    } catch (error) {
      console.error('Failed to save settings to DB:', error);
    }
  }, [user, getIdToken]);

  const updateSettings = useCallback(async (partialSettings: Partial<UserSettings>) => {
    // 1. Update local state
    setSettings(prev => prev ? ({ ...prev, ...partialSettings }) : null);

    // 2. Update theme state if relevant
    if (partialSettings.themeName) setThemeName(partialSettings.themeName);
    if (partialSettings.themeMode) setThemeMode(partialSettings.themeMode);

    // 3. Persist to database
    await saveSettingsToDB(partialSettings);
  }, [saveSettingsToDB]);


  // --- Theme Controls ---

  const handleSetTheme = useCallback((name: string) => {
    setThemeName(name);
    updateSettings({ themeName: name });
  }, [updateSettings]);

  const handleSetMode = useCallback((mode: 'light' | 'dark') => {
    setThemeMode(mode);
    updateSettings({ themeMode: mode });
  }, [updateSettings]);

  // --- Effects ---

  // 1. Fetch settings on user change/initial load
  useEffect(() => {
    if (user && !authLoading) {
        fetchSettings();
    } else if (!user && !authLoading) {
        // Reset state for non-logged-in users, but keep loading state false
        setSettings(null);
        setThemeName('default');
        setThemeMode('dark');
        setLoadingSettings(false);
    }
  }, [user, authLoading, fetchSettings]);

  // 2. Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);


  const value = {
    themeName,
    themeMode,
    currentTheme,
    settings,
    loadingSettings,
    setTheme: handleSetTheme,
    setMode: handleSetMode,
    updateSettings,
    availableThemes: THEMES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};