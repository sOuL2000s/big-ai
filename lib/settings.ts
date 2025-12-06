// lib/settings.ts
import { db } from './firebaseAdmin';
import { UserSettings, PromptTemplate } from '@/types/chat';

const SETTINGS_COLLECTION = 'user_settings';
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-09-2025';

const DEFAULT_SETTINGS: UserSettings = {
    userId: 'default', 
    globalModel: DEFAULT_MODEL,
    globalSystemPrompt: 'You are Big AI, a helpful and large-scale language model developed by Google. Respond concisely and professionally.',
    themeName: 'default', // NEW
    themeMode: 'dark', // NEW
    apiKey: null, // NEW
    templates: [], // NEW
    streamingEnabled: true, // <-- UPDATED DEFAULT
}

/**
 * Retrieves the global settings for a user, merging with defaults if necessary.
 */
export async function getSettings(userId: string): Promise<UserSettings> {
    const docRef = db.collection(SETTINGS_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (doc.exists) {
        const storedSettings = doc.data() as UserSettings;
        return { 
            ...DEFAULT_SETTINGS, 
            ...storedSettings, 
            userId,
            globalModel: storedSettings.globalModel || DEFAULT_MODEL, 
            themeMode: storedSettings.themeMode || 'dark',
            themeName: storedSettings.themeName || 'default',
            templates: storedSettings.templates || [],
            apiKey: storedSettings.apiKey || null,
            streamingEnabled: storedSettings.streamingEnabled ?? true, // <-- Handle potential undefined/null
        };
    }

    // If no settings exist, return defaults
    return { ...DEFAULT_SETTINGS, userId };
}

/**
 * Saves or updates the global settings for a user.
 * It uses { merge: true } to prevent overwriting other fields.
 */
export async function saveSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    const docRef = db.collection(SETTINGS_COLLECTION).doc(userId);
    
    // Explicitly construct the payload to ensure only defined fields are updated
    const updatePayload: Partial<UserSettings> = {
        userId: userId,
    };
    
    if (settings.globalModel !== undefined) updatePayload.globalModel = settings.globalModel;
    if (settings.globalSystemPrompt !== undefined) updatePayload.globalSystemPrompt = settings.globalSystemPrompt;
    if (settings.themeName !== undefined) updatePayload.themeName = settings.themeName;
    if (settings.themeMode !== undefined) updatePayload.themeMode = settings.themeMode;
    if (settings.apiKey !== undefined) updatePayload.apiKey = settings.apiKey;
    if (settings.templates !== undefined) updatePayload.templates = settings.templates;
    if (settings.streamingEnabled !== undefined) updatePayload.streamingEnabled = settings.streamingEnabled; // <-- NEW
    
    await docRef.set(updatePayload, { merge: true });
}
