// lib/settings.ts
import { db } from './firebaseAdmin';
import { UserSettings } from '@/types/chat';

const SETTINGS_COLLECTION = 'user_settings';

const DEFAULT_SETTINGS: UserSettings = {
    userId: 'default', // Placeholder, replaced upon fetch/save
    globalModel: 'gemini-2.5-flash-preview-09-2025', // <-- UPDATED DEFAULT MODEL
    globalSystemPrompt: 'You are Big AI, a helpful and large-scale language model developed by Google. Respond concisely and professionally.',
}

/**
 * Retrieves the global settings for a user.
 */
export async function getSettings(userId: string): Promise<UserSettings> {
    const docRef = db.collection(SETTINGS_COLLECTION).doc(userId);
    const doc = await docRef.get();

    if (doc.exists) {
        return doc.data() as UserSettings;
    }

    // If no settings exist, return defaults
    return { ...DEFAULT_SETTINGS, userId };
}

/**
 * Saves or updates the global settings for a user.
 */
export async function saveSettings(userId: string, settings: Partial<UserSettings>): Promise<void> {
    const docRef = db.collection(SETTINGS_COLLECTION).doc(userId);
    
    // Ensure we only update allowed fields and set the userId
    const updatePayload = {
        ...settings,
        userId: userId,
    };

    await docRef.set(updatePayload, { merge: true });
}