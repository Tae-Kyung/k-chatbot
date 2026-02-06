import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { generateEmbedding } from './embeddings';
import OpenAI from 'openai';

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

function createDirectClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function translateToKorean(query: string, language: string): Promise<string> {
  if (language === 'ko') return query;

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '다음 텍스트를 한국어로 정확히 번역하세요. 대학교 이름, 기관명 등 고유명사는 원문을 유지하세요. 번역된 한국어 텍스트만 출력하세요.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0,
      max_tokens: 500,
    });
    return response.choices[0].message.content?.trim() || query;
  } catch (error) {
    console.error('[Search] Translation failed, using original query:', error);
    return query;
  }
}

export async function searchDocuments(
  query: string,
  universityId: string,
  options: { topK?: number; threshold?: number; language?: string } = {}
): Promise<SearchResult[]> {
  const { topK = 5, threshold = 0.3, language = 'ko' } = options;

  // Translate non-Korean queries to Korean for better retrieval
  const searchQuery = await translateToKorean(query, language);
  if (language !== 'ko') {
    console.log(`[Search] Translated: "${query}" → "${searchQuery}"`);
  }

  const queryEmbedding = await generateEmbedding(searchQuery);
  console.log(`[Search] Query embedding length: ${queryEmbedding.length}`);

  // Always use service role client for RPC functions
  const supabase = createDirectClient();

  console.log(`[Search] Calling RPC with universityId: ${universityId}, topK: ${topK}`);

  // Format embedding as PostgreSQL vector literal: [0.1,0.2,...]
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  console.log(`[Search] Embedding first 200 chars: ${embeddingStr.substring(0, 200)}`);

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embeddingStr,
    match_count: topK,
    filter_university_id: universityId,
  });

  if (error) {
    console.error('[Search] RPC error:', error);
    console.error('[Search] RPC error details:', JSON.stringify(error));
    return [];
  }

  console.log(`[Search] RPC returned ${data?.length ?? 0} results`);

  const rawCount = data?.length ?? 0;
  const filtered = (data || [])
    .filter((result) => result.similarity >= threshold)
    .map((result) => ({
      id: result.id,
      content: result.content,
      metadata: (result.metadata ?? {}) as Record<string, unknown>,
      similarity: result.similarity,
    }));

  console.log(`[Search] Raw results: ${rawCount}, After threshold(${threshold}): ${filtered.length}`);
  if (rawCount > 0 && filtered.length === 0) {
    console.log(`[Search] All results below threshold. Top similarity: ${data![0].similarity?.toFixed(3)}`);
  }

  return filtered;
}
