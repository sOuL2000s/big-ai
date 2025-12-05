// lib/history.ts
import { db, admin } from './firebaseAdmin'; 
import { Conversation, ChatMessage, Role, FileAttachment } from '@/types/chat'; 
import { v4 as uuidv4 } from 'uuid';

const CONVERSATIONS_COLLECTION = 'conversations';

// Define the stored structure (using number for timestamp)
interface FirestoreMessage {
    id: string;
    text: string;
    role: Role;
    timestamp: number;
    files?: FileAttachment[];
}

// Helper to generate a conversational title
function generateTitle(firstMessage: string): string {
    const words = firstMessage.split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    if (words.length > 5) {
        title += '...';
    }
    return title || "New Chat";
}

// Helper function to prepare a ChatMessage for Firestore serialization
function serializeMessage(message: ChatMessage): FirestoreMessage {
    const serialized: FirestoreMessage = {
        id: message.id,
        text: message.text,
        role: message.role,
        timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : message.timestamp,
    };
    
    // CRITICAL FIX: Only include the 'files' field if files exist, 
    // as Firestore forbids storing 'undefined'.
    if (message.files && message.files.length > 0) {
        serialized.files = message.files;
    }

    return serialized;
}


/**
 * Retrieves a conversation by its ID.
 */
export async function getConversation(chatId: string, userId: string): Promise<Conversation | null> {
    const docRef = db.collection(CONVERSATIONS_COLLECTION).doc(chatId);
    const doc = await docRef.get();

    if (!doc.exists) {
        return null;
    }
    
    const data = doc.data() as Omit<Conversation, 'messages' | 'createdAt' | 'updatedAt'> & { 
        messages: FirestoreMessage[],
        createdAt: number,
        updatedAt: number,
    };

    // Security check: Ensure the conversation belongs to the authenticated user
    if (data.userId !== userId) {
        console.warn(`Access denied: User ${userId} attempted to access chat ${chatId} belonging to ${data.userId}`);
        return null;
    }
    
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
export async function createConversation(
    userId: string, 
    firstMessage: string, 
    files: FileAttachment[] = [],
    model?: string, // NEW PARAMETER
    systemPrompt?: string // NEW PARAMETER
): Promise<Conversation> {
    const chatId = uuidv4();
    const now = Date.now();
    
    const userMessage: ChatMessage = {
        id: uuidv4(),
        text: firstMessage,
        role: 'user' as Role,
        timestamp: now,
        files: files.length > 0 ? files : undefined,
    };
    
    // Use the helper to correctly serialize the message
    const serializedUserMessage = serializeMessage(userMessage);

    const newConversation = {
        id: chatId,
        userId,
        createdAt: now,
        updatedAt: now,
        title: generateTitle(firstMessage), 
        messages: [serializedUserMessage], // Use serialized message
        model: model || 'gemini-2.5-flash-preview-09-2025', 
        // Only include systemPrompt if it's explicitly set (or remove it from the object if undefined)
        ...(systemPrompt && { systemPrompt: systemPrompt }),
    };

    await db.collection(CONVERSATIONS_COLLECTION).doc(chatId).set(newConversation);

    // Return the client-side Conversation object (with Date objects)
    return {
        ...newConversation,
        messages: [userMessage],
        createdAt: new Date(now),
        updatedAt: new Date(now),
    } as Conversation;
}

/**
 * Appends a new user message and the subsequent AI response to an existing conversation.
 */
export async function updateConversation(
    chatId: string, 
    userText: string, 
    modelText: string,
    userId: string, // Require User ID for security
    files: FileAttachment[] = [],
    isFirstExchange: boolean = false
): Promise<void> {
    
    // First, verify access (optional, but good practice if not done upstream)
    const docRef = db.collection(CONVERSATIONS_COLLECTION).doc(chatId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.userId !== userId) {
        throw new Error("Unauthorized chat update attempt.");
    }
    
    const now = Date.now();
    
    const userMessage: ChatMessage = {
        id: uuidv4(),
        text: userText,
        role: 'user' as Role,
        timestamp: now,
        files: files.length > 0 ? files : undefined,
    };
    
    const modelMessage: ChatMessage = {
        id: uuidv4(),
        text: modelText,
        role: 'model' as Role,
        timestamp: now,
    };

    // Serialize messages for Firestore
    const serializedUserMessage = serializeMessage(userMessage);
    const serializedModelMessage = serializeMessage(modelMessage);

    const updateData: { messages: admin.firestore.FieldValue; updatedAt: number; title?: string } = {
        messages: admin.firestore.FieldValue.arrayUnion(serializedUserMessage, serializedModelMessage),
        updatedAt: now,
    };

    if (isFirstExchange) {
        // If it was the first exchange, we ensure the title is updated
        updateData.title = generateTitle(userText);
    }
    
    await docRef.update(updateData);
}

// New function to delete all chats for a user
export async function deleteAllUserConversations(userId: string): Promise<void> {
    const batch = db.batch();
    const snapshot = await db.collection(CONVERSATIONS_COLLECTION)
        .where('userId', '==', userId)
        .get();

    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}