import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/rag/search';
import { buildSystemPrompt, assessConfidence } from '@/lib/rag/prompts';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedLanguage } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const FALLBACK_MESSAGES: Record<SupportedLanguage, string> = {
  ko: '죄송합니다. 해당 질문에 대한 정확한 정보를 찾지 못했습니다. 국제교류팀에 직접 문의해 주시면 더 정확한 답변을 받으실 수 있습니다.',
  en: 'Sorry, I could not find accurate information for your question. Please contact the International Office directly for a more precise answer.',
  zh: '抱歉，未能找到准确信息。请直接联系国际交流处获取更准确的回答。',
  vi: 'Xin lỗi, tôi không tìm thấy thông tin chính xác. Vui lòng liên hệ trực tiếp Phòng Hợp tác Quốc tế để được giải đáp chính xác hơn.',
  mn: 'Уучлаарай, таны асуултад тохирох мэдээлэл олдсонгүй. Олон улсын харилцааны алба руу шууд хандана уу.',
  km: 'សូមអភ័យទោស ខ្ញុំរកព័ត៌មានត្រឹមត្រូវមិនឃើញទេ។ សូមទាក់ទងការិយាល័យអន្តរជាតិដោយផ្ទាល់។',
};

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

    if (message.length > 1000) {
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

    // Create or get conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv } = await supabase
        .from('conversations')
        .insert({ university_id: universityId, language })
        .select('id')
        .single();
      convId = conv?.id;
    }

    // Save user message
    const userMsgId = uuidv4();
    await supabase.from('messages').insert({
      id: userMsgId,
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // RAG: Search for relevant documents (translate query to Korean for non-Korean users)
    console.log(`[Chat] Query: "${message}" | University: ${universityId} | Language: ${language}`);
    const searchResults = await searchDocuments(message, universityId, {
      topK: 5,
      threshold: 0.3,
      language,
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
      language as SupportedLanguage,
      searchResults
    );

    // Get conversation history
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(20);

    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Stream response from OpenAI
    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      stream: true,
      max_tokens: 1000,
      temperature: 0.3,
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

          // If confidence is low, append fallback message
          if (confidence.level === 'low' && searchResults.length === 0) {
            const fallback = '\n\n---\n\n' + (FALLBACK_MESSAGES[language as SupportedLanguage] || FALLBACK_MESSAGES['ko']);
            fullResponse += fallback;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'content', content: fallback })}\n\n`
              )
            );
          }

          // Send sources if available
          if (searchResults.length > 0) {
            const sources = searchResults.map((r) => ({
              title: (r.metadata as { file_name?: string })?.file_name || 'Document',
              similarity: Math.round(r.similarity * 100),
            }));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'sources', sources })}\n\n`
              )
            );
          }

          // Save assistant message to DB
          await supabase.from('messages').insert({
            id: assistantMsgId,
            conversation_id: convId,
            role: 'assistant',
            content: fullResponse,
            sources: searchResults.length > 0
              ? searchResults.map((r) => ({
                  title: (r.metadata as { file_name?: string })?.file_name || 'Document',
                  similarity: r.similarity,
                }))
              : null,
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
