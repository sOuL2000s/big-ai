// components/SettingsPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { UserSettings } from '@/types/chat';

interface SettingsPanelProps {
    onClose: () => void;
}

const MODELS = [
    { name: 'Gemini 2.5 Flash (Preview 09-2025)', id: 'gemini-2.5-flash-preview-09-2025', description: 'The recommended default model, stable and powerful.' }, // <-- NEW DEFAULT
    { name: 'Gemini 2.5 Flash (Stable)', id: 'gemini-2.5-flash', description: 'Fast and versatile, ideal for chat.' },
    { name: 'Gemini 2.5 Pro', id: 'gemini-2.5-pro', description: 'Most capable model for complex tasks.' },
    { name: 'Gemini 3.0 Pro', id: 'gemini-3-pro-preview', description: 'Experimental, highest reasoning capability.' },
];

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
    const { user, getIdToken } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Fetch settings on load
    useEffect(() => {
        const fetchSettings = async () => {
            if (!user) return;
            try {
                const token = await getIdToken();
                const response = await fetch('/api/settings', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data: UserSettings = await response.json();
                    setSettings(data);
                } else {
                    console.error("Failed to fetch settings.");
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [user, getIdToken]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !settings) return;

        setSaving(true);
        setStatusMessage(null);
        try {
            const token = await getIdToken();
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    globalModel: settings.globalModel,
                    globalSystemPrompt: settings.globalSystemPrompt,
                }),
            });

            if (response.ok) {
                setStatusMessage('Settings saved successfully!');
            } else {
                setStatusMessage('Failed to save settings.');
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            setStatusMessage('An error occurred during saving.');
        } finally {
            setSaving(false);
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => prev ? ({ ...prev, [name]: value }) : null);
    };

    if (loading) {
        return (
             <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center text-white z-50">
                 Loading settings...
            </div>
        )
    }
    
    if (!settings) return null; 

    return (
        <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-700">
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
                    <h2 className="text-2xl font-bold text-white">AI Settings & Prompts</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Model Selection */}
                    <div>
                        <label htmlFor="globalModel" className="block text-sm font-medium text-gray-300 mb-1">
                            Default AI Model
                        </label>
                        <select
                            id="globalModel"
                            name="globalModel"
                            value={settings.globalModel}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-700 rounded-lg bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            {MODELS.map(model => (
                                <option key={model.id} value={model.id}>
                                    {model.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {MODELS.find(m => m.id === settings.globalModel)?.description}
                        </p>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <label htmlFor="globalSystemPrompt" className="block text-sm font-medium text-gray-300 mb-1">
                            Global System Prompt (Personality)
                        </label>
                        <textarea
                            id="globalSystemPrompt"
                            name="globalSystemPrompt"
                            value={settings.globalSystemPrompt}
                            onChange={handleInputChange}
                            rows={4}
                            placeholder="Set an instruction to define the AI's behavior..."
                            className="w-full p-3 border border-gray-700 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This prompt defines the AI&apos;s behavior for all *new* conversations.
                        </p>
                    </div>
                    
                    {/* Save Button */}
                    <div className="flex justify-between items-center pt-4">
                        {statusMessage && (
                            <p className={`text-sm ${statusMessage.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>
                                {statusMessage}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-400"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}