// types/chat.ts

export type Role = 'user' | 'model';

export interface FileAttachment {
    base64Data: string; // Base64 encoded file content
    mimeType: string;
    filename: string;
    size: number; // File size in bytes
}

export interface ChatMessage {
    id: string; // UUID for message
    text: string;
    role: Role;
    timestamp: Date | number; // Use number (milliseconds) for Firestore
    files?: FileAttachment[]; // NEW: Optional files sent with the message
}

export interface Conversation {
    id: string; // UUID for conversation
    userId: string; // Required when Auth is implemented
    createdAt: Date | number;
    updatedAt: Date | number;
    title: string;
    messages: ChatMessage[];
    model?: string;
    systemPrompt?: string;
}

// NEW: Prompt Template structure
export interface PromptTemplate {
    id: string;
    name: string;
    content: string;
    model?: string;
}

// Global User Settings
export interface UserSettings {
    userId: string;
    globalModel: string;
    globalSystemPrompt: string;
    themeName: string; // NEW
    themeMode: 'light' | 'dark'; // NEW
    apiKey?: string | null; // NEW: Stored Gemini API Key
    templates?: PromptTemplate[]; // NEW: Stored templates
    streamingEnabled: boolean; // <-- ADDED: Controls typewriter effect
}

// --- Gemini Types ---
export interface TextPart {
    text: string;
}

export interface InlineDataPart {
    inlineData: {
        data: string; // Base64 content
        mimeType: string;
    };
}

export interface GeminiContent {
    role: 'user' | 'model';
    parts: (TextPart | InlineDataPart)[]; 
}
