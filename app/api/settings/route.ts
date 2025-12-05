// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthId } from '@/lib/firebaseAdmin';
import { getSettings, saveSettings } from '@/lib/settings';
import { UserSettings, PromptTemplate } from '@/types/chat';

export const runtime = 'nodejs';

// --- GET: Load user settings ---
export async function GET(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const settings = await getSettings(userId);
        // Ensure sensitive info (API Key) is only returned if explicitly requested or handled carefully.
        // For simplicity, we return the full settings object here as it's authenticated.
        return NextResponse.json(settings);
    } catch (error) {
        console.error('API GET Settings Error:', error);
        return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
    }
}

// --- POST: Save user settings ---
export async function POST(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body: Partial<UserSettings> = await req.json();
        
        // Use the saveSettings logic from lib/settings, which handles merging
        await saveSettings(userId, body);

        return NextResponse.json({ message: 'Settings saved successfully' });
    } catch (error) {
        console.error('API POST Settings Error:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}