// lib/history.ts
import { db, admin } from './firebaseAdmin'; 
import { Conversation, ChatMessage, Role, GeminiContent } from '@/types/chat'; 
import { v4 as uuidv4 } from 'uuid';

const CONVERSATIONS_COLLECTION = 'conversations';

interface FirestoreMessage {
    id: string;
    text: string;
    role: Role;
    timestamp: number;
}

// Helper to generate a conversational title
function generateTitle(firstMessage: string): string {
    // In a real production app, you would call a quick LLM model (e.g., GPT-3.5 or Gemini Nano) 
    // to summarize the thread title here. For now, we use the first 6 words.
    const words = firstMessage.split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    if (words.length > 5) {
        title += '...';
    }
    return title;
}

/**
 * Retrieves a conversation by its ID.
 */
export async function getConversation(chatId: string): Promise<Conversation | null> {
    const docRef = db.collection(CONVERSATIONS_COLLECTION).doc(chatId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return null;
    }

    const data = doc.data() as Omit<Conversation, 'messages'> & { messages: FirestoreMessage[] };
    
    const conversation: Conversation = {
        ...data,
        messages: data.messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp), 
        })),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
    };

    return conversation;
}

/**
 * Creates a new conversation and adds the first message.
 */
export async function createConversation(userId: string | undefined, firstMessage: string): Promise<Conversation> {
    const chatId = uuidv4();
    const now = Date.now();
    
    const userMessage: ChatMessage = {
        id: uuidv4(),
        text: firstMessage,
        role: 'user' as Role,
        timestamp: now,
    };

    const newConversation: Conversation = {
        id: chatId,
        userId,
        createdAt: now,
        updatedAt: now,
        title: generateTitle(firstMessage), // Use first message as title
        messages: [userMessage],
    };

    await db.collection(CONVERSATIONS_COLLECTION).doc(chatId).set(newConversation);

    return newConversation;
}

/**
 * Appends a new user message and the subsequent AI response to an existing conversation, 
 * and optionally generates a title if it's the first exchange.
 */
export async function updateConversation(
    chatId: string, 
    userText: string, 
    modelText: string,
    isFirstExchange: boolean = false
): Promise<void> {
    
    const userMessage: ChatMessage = {
        id: uuidv4(),
        text: userText,
        role: 'user' as Role,
        timestamp: Date.now(),
    };
    
    const modelMessage: ChatMessage = {
        id: uuidv4(),
        text: modelText,
        role: 'model' as Role,
        timestamp: Date.now(),
    };

    const docRef = db.collection(CONVERSATIONS_COLLECTION).doc(chatId);

    const updateData: { messages: admin.firestore.FieldValue; updatedAt: number; title?: string } = {
        messages: admin.firestore.FieldValue.arrayUnion(userMessage, modelMessage),
        updatedAt: Date.now(),
    };

    if (isFirstExchange) {
        // If the chat was initialized and we are now saving the first response, 
        // we can set the title here if we hadn't already. 
        // (Note: In our current setup, title is already set in createConversation, but keeping this robust)
        updateData.title = generateTitle(userText);
    }
    
    await docRef.update(updateData);
}

/**
 * Converts stored chat messages into the format required by the Gemini SDK.
 */
export function historyToGeminiContents(messages: ChatMessage[]): GeminiContent[] { 
    // Exclude the last message, as that is the current prompt provided separately
    return messages.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }],
    }));
}