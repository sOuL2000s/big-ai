// types/chat.ts

export type Role = 'user' | 'model';

export interface ChatMessage {
    id: string; // UUID for message
    text: string;
    role: Role;
    timestamp: Date | number; // Use number (milliseconds) for Firestore
}

export interface Conversation {
    id: string; // UUID for conversation
    userId?: string; // Optional user ID (if auth is implemented)
    createdAt: Date | number;
    updatedAt: Date | number;
    title: string;
    messages: ChatMessage[];
}

export interface GeminiContent {
    role: 'user' | 'model';
    parts: { text: string }[];
}