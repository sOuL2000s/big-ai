// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateStreamingResponse } from '@/lib/gemini';
import { getConversation, createConversation, updateConversation } from '@/lib/history';
import { ChatMessage, Conversation } from '@/types/chat';

export const runtime = 'nodejs'; 

// Define the response type for the client to handle context
interface ChatRequest {
    chatId?: string; 
    message: string;
}

// --- GET: Load existing conversation history ---
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
        }

        const conversation = await getConversation(chatId);

        if (!conversation) {
             return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Return the full conversation object
        return NextResponse.json(conversation);

    } catch (error) {
        console.error('API GET Error:', error);
        return NextResponse.json({ error: 'Failed to retrieve chat history' }, { status: 500 });
    }
}


// --- POST: Handle new message/streaming ---
export async function POST(req: NextRequest) {
  try {
    const { message, chatId: incomingChatId }: ChatRequest = await req.json();

    if (!message || message.trim() === '') {
        return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    let conversation: Conversation | null = null;
    let chatId = incomingChatId;

    if (chatId) {
        conversation = await getConversation(chatId);
    } else {
        // Mock user ID (should come from actual session/auth)
        conversation = await createConversation('mock_user_id', message);
        chatId = conversation.id;
    }

    // 1. Generate the streaming response
    const history: ChatMessage[] = conversation?.messages || [];
    
    const fullHistoryContext: ChatMessage[] = [
        ...history,
        { id: 'temp', text: message, role: 'user', timestamp: Date.now() } as ChatMessage
    ];

    const stream = await generateStreamingResponse(
        fullHistoryContext,
        message
    );
    
    // 2. Read the entire stream response to save it to the database
    let fullBotResponse = '';
    
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
            
            // 3. Persist the full exchange asynchronously
            if (chatId) {
                await updateConversation(chatId, message, fullBotResponse, conversation?.messages.length === 0);
            }
        } catch (dbError) {
            console.error('CRITICAL: Error saving history to Firestore:', dbError);
        }
    })();
    
    // 4. Send the streaming response back to the client immediately
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
    return NextResponse.json({ error: 'Failed to process chat request.' }, { status: 500 });
  }
}