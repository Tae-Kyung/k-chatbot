import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/rag/search';
import { buildSystemPrompt, assessConfidence } from '@/lib/rag/prompts';
import { getOpenAI } from '@/lib/openai/client';
import { deduplicateSources } from '@/lib/chat/sources';
import { buildChatMessages } from '@/lib/chat/history';
import { MAX_MESSAGE_LENGTH, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS_CHAT } from '@/config/constants';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedLanguage } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const preferredRegion = 'icn1';

function detectLanguage(text: string): SupportedLanguage {
  const cleaned = text.replace(/[\s\d\p{P}]/gu, '');
  if (!cleaned) return 'ko';

  let hangul = 0, cjk = 0, khmer = 0, cyrillic = 0;

  for (const char of cleaned) {
    const code = char.codePointAt(0)!;
    if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF) || (code >= 0x3130 && code <= 0x318F)) {
      hangul++;
    } else if (code >= 0x4E00 && code <= 0x9FFF) {
      cjk++;
    } else if (code >= 0x1780 && code <= 0x17FF) {
      khmer++;
    } else if (code >= 0x0400 && code <= 0x04FF) {
      cyrillic++;
    }
  }

  const total = cleaned.length;
  if (hangul / total > 0.3) return 'ko';
  if (cjk / total > 0.3) return 'zh';
  if (khmer / total > 0.3) return 'km';
  if (cyrillic / total > 0.3) return 'mn';
  if (/[ăâđêôơưĂÂĐÊÔƠƯàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/.test(text)) return 'vi';

  return 'en';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { universityId, message, language = 'ko', conversationId } = body;

    if (!universityId || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message too long' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = await createServiceClient();

    // Get university info
    const { data: university } = await supabase
      .from('universities')
      .select('*')
      .eq('id', universityId)
      .single();

    if (!university) {
      return new Response(
        JSON.stringify({ success: false, error: 'University not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Detect actual language from user message
    const detectedLang = detectLanguage(message);

    // Create or get conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv } = await supabase
        .from('conversations')
        .insert({ university_id: universityId, language: detectedLang })
        .select('id')
        .single();
      convId = conv?.id;
    } else {
      // Update language if user switched languages mid-conversation
      await supabase
        .from('conversations')
        .update({ language: detectedLang })
        .eq('id', convId);
    }

    // Save user message
    const userMsgId = uuidv4();
    await supabase.from('messages').insert({
      id: userMsgId,
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // RAG: Search for relevant documents (settings loaded dynamically from rag_settings)
    console.log(`[Chat] Query: "${message}" | University: ${universityId} | Language: ${detectedLang}`);
    const searchResults = await searchDocuments(message, universityId, {
      language: detectedLang,
    });
    console.log(`[Chat] Search results: ${searchResults.length} found`, searchResults.map(r => ({
      similarity: r.similarity.toFixed(3),
      content: r.content.substring(0, 80) + '...',
    })));

    // Assess confidence
    const confidence = assessConfidence(searchResults);
    console.log(`[Chat] Confidence: ${confidence.level} (score: ${confidence.score.toFixed(3)})`);

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(
      university.name,
      detectedLang,
      searchResults
    );

    // Get conversation history (only recent messages to prevent old context from overriding RAG)
    const chatMessages = await buildChatMessages(supabase, convId, systemPrompt);

    // Stream response from OpenAI
    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: chatMessages,
      stream: true,
      max_tokens: LLM_MAX_TOKENS_CHAT,
      temperature: LLM_TEMPERATURE,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';
    const assistantMsgId = uuidv4();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send metadata first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'meta',
                conversationId: convId,
                messageId: assistantMsgId,
                confidence: confidence.level,
              })}\n\n`
            )
          );

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'content', content })}\n\n`
                )
              );
            }
          }

          // Strip any leftover followups marker from LLM output
          fullResponse = fullResponse.replace(/\s*<!--followups:\[[\s\S]*?\]-->\s*$/, '').trimEnd();

          // Send sources if available (deduplicated by file_name)
          const dbSources = deduplicateSources(searchResults);
          if (dbSources.length > 0) {
            const sources = dbSources.map(s => ({
              title: s.title,
              similarity: Math.round(s.similarity * 100),
            }));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'sources', sources })}\n\n`
              )
            );
          }

          await supabase.from('messages').insert({
            id: assistantMsgId,
            conversation_id: convId,
            role: 'assistant',
            content: fullResponse,
            sources: dbSources.length > 0 ? dbSources : null,
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
