import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { searchDocuments } from '@/lib/rag/search';
import { buildSystemPrompt, assessConfidence } from '@/lib/rag/prompts';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import type { SupportedLanguage } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const preferredRegion = 'icn1';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    // RAG: Search for relevant documents (settings loaded dynamically from rag_settings)
    console.log(`[Chat] Query: "${message}" | University: ${universityId} | Language: ${language}`);
    const searchResults = await searchDocuments(message, universityId, {
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

    // Get conversation history (only recent messages to prevent old context from overriding RAG)
    const { data: allHistory } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(6);

    // Reverse to chronological order (fetched in desc order to get the latest)
    const history = (allHistory || []).reverse();

    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m: { role: string; content: string }) => ({
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
          // Send metadata first (includes debug info for search result sources)
          const debugSources = searchResults.map(r => ({
            file: (r.metadata as { file_name?: string })?.file_name || '?',
            sim: Number(r.similarity.toFixed(3)),
          }));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'meta',
                conversationId: convId,
                messageId: assistantMsgId,
                confidence: confidence.level,
                _debug: { resultCount: searchResults.length, sources: debugSources },
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

          // Fallback handling is delegated to the system prompt (noContext instruction)
          // to avoid contradictory double messages when LLM answers from general knowledge

          // Send sources if available (deduplicated by file_name)
          if (searchResults.length > 0) {
            const sourceMap = new Map<string, number>();
            for (const r of searchResults) {
              const title = (r.metadata as { file_name?: string })?.file_name || 'Document';
              const similarity = Math.round(r.similarity * 100);
              // Keep highest similarity for each unique title
              if (!sourceMap.has(title) || sourceMap.get(title)! < similarity) {
                sourceMap.set(title, similarity);
              }
            }
            const sources = Array.from(sourceMap.entries()).map(([title, similarity]) => ({
              title,
              similarity,
            }));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'sources', sources })}\n\n`
              )
            );
          }

          // Save assistant message to DB (deduplicated sources)
          const dbSourceMap = new Map<string, number>();
          for (const r of searchResults) {
            const title = (r.metadata as { file_name?: string })?.file_name || 'Document';
            if (!dbSourceMap.has(title) || dbSourceMap.get(title)! < r.similarity) {
              dbSourceMap.set(title, r.similarity);
            }
          }
          const dbSources = Array.from(dbSourceMap.entries()).map(([title, similarity]) => ({
            title,
            similarity,
          }));

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
