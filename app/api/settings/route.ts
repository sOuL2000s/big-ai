// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthId } from '@/lib/firebaseAdmin';
import { getSettings, saveSettings } from '@/lib/settings';
import { UserSettings } from '@/types/chat';

export const runtime = 'nodejs';

// --- GET: Load user settings ---
export async function GET(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const settings = await getSettings(userId);
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
        
        // Use the saveSettings logic from lib/settings
        await saveSettings(userId, body);

        return NextResponse.json({ message: 'Settings saved successfully' });
    } catch (error) {
        console.error('API POST Settings Error:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}