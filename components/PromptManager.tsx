// components/PromptManager.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeContext';
import { PromptTemplate, UserSettings } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

interface PromptManagerProps {
    onClose: () => void;
}

const MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash (Recommended)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Stable)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
];

export default function PromptManager({ onClose }: PromptManagerProps) {
    const { user } = useAuth();
    const { settings, updateSettings } = useTheme();
    
    // Local state for forms
    const [globalPrompt, setGlobalPrompt] = useState(settings?.globalSystemPrompt || '');
    const [apiKeyInput, setApiKeyInput] = useState(settings?.apiKey || '');
    const [templates, setTemplates] = useState<PromptTemplate[]>(settings?.templates || []);

    const [templateName, setTemplateName] = useState('');
    const [templateContent, setTemplateContent] = useState('');
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // --- Global Prompt/Model/API Key Handlers ---

    const handleSaveGlobalSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        const newPrompt = globalPrompt.trim();

        await updateSettings({
            globalSystemPrompt: newPrompt,
            globalModel: settings?.globalModel, // Keep model synced
            apiKey: apiKeyInput.trim() || null,
        });

        setStatusMessage('Global settings saved successfully!');
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleClearGlobalPrompt = async () => {
        setGlobalPrompt('');
        await updateSettings({ globalSystemPrompt: '' });
        setStatusMessage('Global prompt cleared.');
        setTimeout(() => setStatusMessage(null), 3000);
    };
    
    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateSettings({ globalModel: e.target.value });
    };

    // --- Template Handlers ---

    const handleClearTemplateForm = () => {
        setTemplateName('');
        setTemplateContent('');
        setEditingTemplateId(null);
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim() || !templateContent.trim()) {
            setStatusMessage('Template name and content are required.');
            return;
        }

        const updatedTemplates = [...templates];
        const newTemplate: PromptTemplate = {
            id: editingTemplateId || uuidv4(),
            name: templateName.trim(),
            content: templateContent.trim(),
        };

        if (editingTemplateId) {
            const index = updatedTemplates.findIndex(t => t.id === editingTemplateId);
            if (index !== -1) {
                updatedTemplates[index] = newTemplate;
                setStatusMessage('Template updated successfully!');
            }
        } else {
            updatedTemplates.push(newTemplate);
            setStatusMessage('Template saved successfully!');
        }

        setTemplates(updatedTemplates);
        await updateSettings({ templates: updatedTemplates });
        handleClearTemplateForm();
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleEditTemplate = (template: PromptTemplate) => {
        setTemplateName(template.name);
        setTemplateContent(template.content);
        setEditingTemplateId(template.id);
    };
    
    const handleDeleteTemplate = async (templateId: string) => {
        if (!window.confirm('Are you sure you want to delete this template?')) return;
        
        const updatedTemplates = templates.filter(t => t.id !== templateId);
        setTemplates(updatedTemplates);
        await updateSettings({ templates: updatedTemplates });
        
        if (editingTemplateId === templateId) {
            handleClearTemplateForm();
        }

        // If the active global prompt matches the deleted template, clear it too.
        if (settings?.globalSystemPrompt === templates.find(t => t.id === templateId)?.content) {
             setGlobalPrompt('');
             await updateSettings({ globalSystemPrompt: '' });
        }

        setStatusMessage('Template deleted.');
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleUseTemplate = async (content: string) => {
        setGlobalPrompt(content);
        await updateSettings({ globalSystemPrompt: content });
        setStatusMessage('Template activated as Global System Prompt!');
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const globalPromptIsActive = globalPrompt.trim() !== '';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border" style={{backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-color)'}}>
                
                <div className="flex justify-between items-center mb-6 border-b pb-3" style={{borderColor: 'var(--border-color)'}}>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: 'var(--accent-primary)'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Prompt & API Configuration
                    </h2>
                    <button onClick={onClose} className="p-1 rounded hover:opacity-80 transition" style={{color: 'var(--text-secondary)'}}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                {/* Status Message */}
                {statusMessage && (
                    <div className={`p-3 mb-4 text-sm rounded-lg text-center ${statusMessage.includes('saved') || statusMessage.includes('activated') ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {statusMessage}
                    </div>
                )}

                {/* --- API Key Management --- */}
                <div className="mb-6 p-4 rounded-lg border" style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'}}>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: 'var(--accent-secondary)'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2v5a2 2 0 01-2 2h-2m-3-1a2 2 0 00-2 2v5m-3-4a2 2 0 002 2h4a2 2 0 002-2v-5a2 2 0 00-2-2m0 0a2 2 0 100-4 2 2 0 000 4z"></path></svg>
                        Gemini API Key
                    </h3>
                    <div className="flex items-center gap-2">
                        <input
                            type="password"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="Enter your private Gemini API Key (optional)"
                            className="w-full p-2 rounded-md border text-sm"
                            style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                        />
                         <button onClick={handleSaveGlobalSettings} className="p-2 rounded-md transition" style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        </button>
                    </div>
                    <p className="text-xs mt-1" style={{color: apiKeyInput.trim() ? 'var(--accent-success)' : 'var(--accent-error)'}}>
                        {apiKeyInput.trim() ? 'Key is set. Your key will be prioritized for API calls.' : 'No key set. Using server fallback key.'}
                    </p>
                </div>

                {/* --- Global System Prompt --- */}
                <form onSubmit={handleSaveGlobalSettings} className="mb-6 p-4 rounded-lg border" style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'}}>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: globalPromptIsActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        Global System Prompt {globalPromptIsActive && <span className='text-xs font-normal' style={{color: 'var(--accent-primary)'}}>(Active)</span>}
                    </h3>
                    <textarea
                        value={globalPrompt}
                        onChange={(e) => setGlobalPrompt(e.target.value)}
                        rows={4}
                        placeholder="Define the AI's personality/behavior for new chats (e.g., 'You are a highly sarcastic chef.')."
                        className="w-full p-3 rounded-md border resize-none"
                        style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                    />
                    <div className="flex justify-between items-center mt-4">
                        <button 
                            type="button"
                            onClick={handleClearGlobalPrompt} 
                            className="px-3 py-2 text-sm rounded-lg transition" 
                            style={{backgroundColor: 'var(--accent-error)', color: 'white'}}
                        >
                            Clear Prompt
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 text-sm rounded-lg transition"
                            style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}}
                        >
                            Save Prompt
                        </button>
                    </div>
                </form>

                {/* --- Prompt Templates Management --- */}
                <div className="p-4 rounded-lg border" style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'}}>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: 'var(--accent-primary)'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Prompt Templates ({templates.length})
                    </h3>
                    
                    {/* Template Input Form */}
                    <div className="mb-4 space-y-2">
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Template Name (e.g., 'Sarcastic AI')"
                            className="w-full p-2 rounded-md border text-sm"
                            style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                        />
                        <textarea
                            value={templateContent}
                            onChange={(e) => setTemplateContent(e.target.value)}
                            rows={3}
                            placeholder="Enter the reusable system prompt content here."
                            className="w-full p-3 rounded-md border resize-none text-sm"
                            style={{backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)'}}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button 
                                type="button"
                                onClick={handleClearTemplateForm} 
                                className="px-3 py-2 text-sm rounded-lg transition" 
                                style={{backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)'}}
                            >
                                Clear Form
                            </button>
                            <button 
                                type="button"
                                onClick={handleSaveTemplate}
                                className="px-4 py-2 text-sm rounded-lg transition"
                                style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}}
                            >
                                {editingTemplateId ? 'Update Template' : 'Save New Template'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Saved Templates List */}
                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2 pt-4 border-t" style={{borderColor: 'var(--border-color)'}}>
                        {templates.length === 0 ? (
                            <li className="text-center text-sm p-4" style={{color: 'var(--text-secondary)'}}>No templates saved yet.</li>
                        ) : (
                            templates.map(template => (
                                <li key={template.id} className="p-3 rounded-lg border" style={{backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)'}}>
                                    <div className="font-semibold mb-1 truncate" style={{color: 'var(--accent-primary)'}}>{template.name}</div>
                                    <p className="text-xs mb-2 truncate" style={{color: 'var(--text-secondary)'}}>
                                        {template.content.substring(0, 100) + (template.content.length > 100 ? '...' : '')}
                                    </p>
                                    <div className="flex gap-2 justify-end text-xs mt-2">
                                        <button onClick={() => handleUseTemplate(template.content)} className="px-2 py-1 rounded transition" style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}}>Use</button>
                                        <button onClick={() => handleEditTemplate(template)} className="px-2 py-1 rounded transition" style={{backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)'}}>Edit</button>
                                        <button onClick={() => handleDeleteTemplate(template.id)} className="px-2 py-1 rounded transition" style={{backgroundColor: 'var(--accent-error)', color: 'white'}}>Delete</button>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                <div className="flex justify-end mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold transition" style={{backgroundColor: 'var(--accent-primary)', color: 'var(--ai-bubble-text)'}}>
                        Close Panel
                    </button>
                </div>
            </div>
        </div>
    );
}