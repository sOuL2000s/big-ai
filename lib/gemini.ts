// lib/gemini.ts
import { GoogleGenerativeAI, EnhancedGenerateContentResponse } from '@google/generative-ai';
import { GeminiContent, ChatMessage, TextPart, InlineDataPart } from '@/types/chat';

const DEFAULT_MODEL = 'gemini-2.5-flash';

function chatMessageToGeminiContent(msg: ChatMessage): GeminiContent {
    const parts: (TextPart | InlineDataPart)[] = []; 
    if (msg.text) parts.push({ text: msg.text });
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
    // Gemini 1.5+ expects 'model' role instead of 'ai' or 'assistant'
    const role = msg.role === 'model' ? 'model' : 'user';
    return { role, parts };
}

export async function generateStreamingResponse(
    history: ChatMessage[],
    systemInstruction?: string,
    model?: string
): Promise<ReadableStream<Uint8Array>> {
    const apiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(k => k !== '');
    if (apiKeys.length === 0) throw new Error("No API keys found in environment variables.");

    const contents: GeminiContent[] = history.map(chatMessageToGeminiContent);
    const targetModel = model || DEFAULT_MODEL;

    const tryRequest = async (keyIndex: number): Promise<AsyncGenerator<EnhancedGenerateContentResponse>> => {
        if (keyIndex >= apiKeys.length) throw new Error("All API keys failed. Check quotas or key validity.");
        
        const genAI = new GoogleGenerativeAI(apiKeys[keyIndex]);
        const modelInstance = genAI.getGenerativeModel({ 
            model: targetModel,
            systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined
        });

        try {
            const result = await modelInstance.generateContentStream({ contents });
            return result.stream;
        } catch (error) {
            console.error(`API Key Index ${keyIndex} failed, retrying with next...`, error);
            return tryRequest(keyIndex + 1);
        }
    };

    const responseStream = await tryRequest(0);
    const encoder = new TextEncoder();
    
    return new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of responseStream) {
                    const text = chunk.text();
                    if (text) controller.enqueue(encoder.encode(text));
                }
            } catch (error) {
                console.error("Streaming error:", error);
            } finally {
                controller.close();
            }
        },
    });
}