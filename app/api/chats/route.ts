// app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, getAuthId } from '@/lib/firebaseAdmin';
import { Conversation } from '@/types/chat';
import { deleteAllUserConversations } from '@/lib/history'; // Server-side import

export const runtime = 'nodejs';

/**
 * Fetches a list of recent conversations for the current user.
 */
export async function GET(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Missing Authentication' }, { status: 401 });
    }
    
    try {
        const snapshot = await db.collection('conversations')
            .where('userId', '==', userId) // Use real User ID
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

/**
 * Deletes all conversations for the current user.
 */
export async function DELETE(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Missing Authentication' }, { status: 401 });
    }
    
    try {
        await deleteAllUserConversations(userId);
        return NextResponse.json({ message: 'All conversations deleted successfully' });

    } catch (error) {
        console.error('Error deleting chat list:', error);
        return NextResponse.json({ error: 'Failed to delete conversations' }, { status: 500 });
    }
}