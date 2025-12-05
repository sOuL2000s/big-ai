// app/api/chats/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { Conversation } from '@/types/chat';

export const runtime = 'nodejs';

// Mock user ID for now, replace with actual authentication in production
const MOCK_USER_ID = 'mock_user_id'; 

/**
 * Fetches a list of recent conversations for the current user.
 */
export async function GET() {
    try {
        const snapshot = await db.collection('conversations')
            .where('userId', '==', MOCK_USER_ID)
            .orderBy('updatedAt', 'desc')
            .limit(20) // Limit to 20 recent chats
            .get();

        const chats = snapshot.docs.map(doc => {
            const data = doc.data() as Conversation;
            
            // Return only necessary data for the sidebar
            return {
                id: data.id,
                title: data.title,
                updatedAt: data.updatedAt,
            };
        });

        return NextResponse.json(chats);

    } catch (error) {
        console.error('Error fetching chat list:', error);
        return NextResponse.json({ error: 'Failed to retrieve conversation list' }, { status: 500 });
    }
}