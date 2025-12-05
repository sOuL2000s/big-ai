// lib/gemini.ts
import { GoogleGenAI } from '@google/genai';
import { GeminiContent, ChatMessage, TextPart, InlineDataPart } from '@/types/chat'; // Import new specific part types

// We use a specific, high-capability model as requested (though slightly modified name for stability)
const MODEL_NAME = 'gemini-2.5-flash-preview-09-2025'; // <-- UPDATED DEFAULT MODEL NAME

// Initialize Gemini Client
const ai = new GoogleGenAI({});

// Helper function to convert client ChatMessage to GeminiContent
function chatMessageToGeminiContent(msg: ChatMessage): GeminiContent {
    // Use imported types for parts array
    const parts: (TextPart | InlineDataPart)[] = []; 

    // 1. Add text part
    if (msg.text) {
        parts.push({ text: msg.text });
    }

    // 2. Add file parts (multimodal)
    if (msg.files && msg.files.length > 0) {
        msg.files.forEach(file => {
            parts.push({
                inlineData: {
                    data: file.base64Data,
                    mimeType: file.mimeType,
                }
            }); 
        });
    }

    // Now returns the correct structure matching the updated GeminiContent interface
    return {
        role: msg.role,
        parts: parts,
    };
}


/**
 * Transforms client/storage messages into the format the Gemini API expects
 * and generates streaming content.
 * 
 * @param history A list of previous messages in the conversation (including the latest user prompt).
 * @returns A ReadableStream of text chunks.
 */
export async function generateStreamingResponse(
    history: ChatMessage[],
    systemInstruction?: string,
): Promise<ReadableStream<Uint8Array>> {
    
    // 1. Prepare contents array (convert ChatMessages to GeminiContent)
    const contents: GeminiContent[] = history.map(chatMessageToGeminiContent);

    // 2. Call the streaming API
    const responseStream = await ai.models.generateContentStream({
        model: MODEL_NAME, // Uses the updated model constant
        contents: contents,
        config: systemInstruction ? { systemInstruction } : undefined,
    });

    // 3. Convert the response stream to a standard Node.js/Next.js ReadableStream
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