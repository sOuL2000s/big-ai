// lib/gemini.ts
import { GoogleGenAI } from '@google/genai';
import { GeminiContent, ChatMessage } from '@/types/chat';

// We use the stable, non-preview version for production
const MODEL_NAME = 'gemini-2.5-flash'; 

// Initialize Gemini Client
const ai = new GoogleGenAI({});

/**
 * Transforms client/storage messages into the format the Gemini API expects
 * and generates streaming content.
 * 
 * @param history A list of previous messages in the conversation.
 * @param latestUserMessage The current user message.
 * @returns A ReadableStream of text chunks.
 */
export async function generateStreamingResponse(
    history: ChatMessage[],
    latestUserMessage: string
): Promise<ReadableStream<Uint8Array>> {
    
    // 1. Prepare contents array
    const contents: GeminiContent[] = [
        ...history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }],
        })),
        // Add the latest user message
        { role: 'user', parts: [{ text: latestUserMessage }] },
    ];

    // 2. Call the streaming API
    const responseStream = await ai.models.generateContentStream({
        model: MODEL_NAME,
        contents: contents,
    });

    // 3. Convert the response stream to a standard Node.js/Next.js ReadableStream
    // The Gemini SDK response stream is an async iterator of objects. We need to map it to a text stream.
    
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
        async start(controller) {
            for await (const chunk of responseStream) {
                const text = chunk.text;
                if (text) {
                    controller.enqueue(encoder.encode(text));
                }
            }
            controller.close();
        },
    });

    return stream;
}