// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateStreamingResponse } from '@/lib/gemini';
import { getConversation, createConversation, updateConversation, deleteConversation } from '@/lib/history';
import { getSettings } from '@/lib/settings';
import { ChatMessage, Conversation, FileAttachment } from '@/types/chat';
import { getAuthId } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs'; 

interface ChatRequest {
    chatId?: string; 
    message: string;
    files?: FileAttachment[];
}

// Helper function to create verbose error response
const createErrorResponse = (error: unknown, defaultMessage: string, status: number) => {
    let errorMessage = defaultMessage;
    let errorDetails: string | undefined = undefined;

    if (error instanceof Error) {
        errorMessage = `Internal Server Error: ${error.message}`;
        // Only expose stack trace in non-production environments
        errorDetails = process.env.NODE_ENV !== 'production' ? error.stack : undefined;
    } else if (typeof error === 'string') {
        errorMessage = `Internal Server Error: ${error}`;
    }

    return NextResponse.json({ 
        error: errorMessage,
        details: errorDetails
    }, { status });
};

// --- GET: Load existing conversation history ---
export async function GET(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Missing Authentication' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
        }

        // Use userId in getConversation for authorization check
        const conversation = await getConversation(chatId, userId);

        if (!conversation) {
             return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json(conversation);

    } catch (error) {
        console.error('API GET Error:', error);
        return createErrorResponse(error, 'Failed to retrieve chat history', 500);
    }
}

// --- DELETE: Delete a specific conversation ---
export async function DELETE(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Missing Authentication' }, { status: 401 });
    }
    
    try {
        const { searchParams } = new URL(req.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
        }
        
        await deleteConversation(chatId, userId);
        
        return NextResponse.json({ message: `Conversation ${chatId} deleted successfully` });

    } catch (error) {
        console.error('API DELETE Error:', error);
        // Specialized handling for known authorization errors from lib/history
        if (error instanceof Error && error.message.includes('Unauthorized')) {
             return NextResponse.json({ error: 'Unauthorized chat deletion attempt' }, { status: 403 });
        }
        return createErrorResponse(error, 'Failed to delete chat history', 500);
    }
}


// --- POST: Handle new message/streaming ---
export async function POST(req: NextRequest) {
    const userId = await getAuthId(req);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized: Missing Authentication' }, { status: 401 });
    }

  try {
    const { message, chatId: incomingChatId, files = [] }: ChatRequest = await req.json();

    if (!message || message.trim() === '') {
        // Allow empty text if files are present (e.g., "Analyze this image")
        if (files.length === 0) {
            return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
        }
    }

    let conversation: Conversation | null = null;
    let chatId = incomingChatId;
    let isFirstExchange = false;

    if (chatId) {
        conversation = await getConversation(chatId, userId);
        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found or unauthorized.' }, { status: 404 });
        }
    } else {
        // NEW: Fetch global settings for model and system prompt
        const userSettings = await getSettings(userId);
        
        // NEW: Create conversation with global settings context
        conversation = await createConversation(
            userId, 
            message, 
            files,
            userSettings.globalModel, // Pass global model
            userSettings.globalSystemPrompt // Pass global system prompt
        );
        chatId = conversation.id;
        isFirstExchange = true;
    }

    // 1. Prepare history and current prompt (including files)
    const history: ChatMessage[] = conversation?.messages || [];
    
    // The current exchange (user message + files) is added to the history context for Gemini
    const userMessageForContext: ChatMessage = { 
        id: 'temp', 
        text: message, 
        role: 'user', 
        timestamp: Date.now(),
        files: files.length > 0 ? files : undefined,
    } as ChatMessage;

    const fullHistoryContext: ChatMessage[] = [
        ...history,
        userMessageForContext
    ];
    
    // Optional: Pass system prompt from conversation settings
    const systemInstruction = conversation?.systemPrompt;

    // 2. Generate the streaming response
    const stream = await generateStreamingResponse(
        fullHistoryContext,
        systemInstruction
    );
    
    // 3. Read the entire stream response to save it to the database
    let fullBotResponse = '';
    
    // Use .tee() to create two identical streams: one for the client, one for history saving
    const [clientStream, historyStream] = stream.tee();
    
    const reader = historyStream.getReader();
    const decoder = new TextDecoder();
    
    // Asynchronously save history
    (async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullBotResponse += decoder.decode(value);
            }
            
            // 4. Persist the full exchange asynchronously
            if (chatId) {
                await updateConversation(chatId, message, fullBotResponse, userId, files, isFirstExchange);
            }
        } catch (dbError) {
            console.error('CRITICAL: Error saving history to Firestore:', dbError);
        }
    })();
    
    // 5. Send the streaming response back to the client immediately
    const response = new NextResponse(clientStream, {
        headers: {
            'Content-Type': 'text/plain',
            'X-Chat-ID': chatId,
        },
        status: 200,
    });
    
    return response;

  } catch (error) {
    console.error('FATAL API Error:', error);
    return createErrorResponse(error, 'Failed to process chat request.', 500);
  }
}