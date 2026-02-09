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

interface RagSettingsCache {
  settings: RagSettingsValues;
  timestamp: number;
}

interface RagSettingsValues {
  embedding_model: string;
  top_k: number;
  match_threshold: number;
  rerank_enabled: boolean;
  hyde_enabled: boolean;
}

const DEFAULT_RAG_SETTINGS: RagSettingsValues = {
  embedding_model: 'text-embedding-3-small',
  top_k: 8,
  match_threshold: 0.15,
  rerank_enabled: false,
  hyde_enabled: false,
};

const CACHE_TTL_MS = 60_000; // 60 seconds
const settingsCache = new Map<string, RagSettingsCache>();

function createDirectClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Get RAG settings for a university with 60-second in-memory cache
 */
async function getRagSettings(universityId: string): Promise<RagSettingsValues> {
  const cached = settingsCache.get(universityId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.settings;
  }

  try {
    const supabase = createDirectClient();
    const { data, error } = await supabase
      .from('rag_settings')
      .select('*')
      .eq('university_id', universityId)
      .single();

    if (error || !data) {
      console.log(`[Search] No rag_settings for ${universityId}, using defaults`);
      settingsCache.set(universityId, {
        settings: DEFAULT_RAG_SETTINGS,
        timestamp: Date.now(),
      });
      return DEFAULT_RAG_SETTINGS;
    }

    const settings: RagSettingsValues = {
      embedding_model: data.embedding_model,
      top_k: data.top_k,
      match_threshold: data.match_threshold,
      rerank_enabled: data.rerank_enabled,
      hyde_enabled: data.hyde_enabled,
    };

    settingsCache.set(universityId, { settings, timestamp: Date.now() });
    return settings;
  } catch (error) {
    console.error('[Search] Failed to load rag_settings:', error);
    return DEFAULT_RAG_SETTINGS;
  }
}

/**
 * Generate a hypothetical answer in Korean for HyDE (Hypothetical Document Embeddings).
 * The idea: embed a "fake answer" to better match against stored Korean document chunks.
 */
async function generateHypotheticalAnswer(
  query: string,
  language: string
): Promise<string> {
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '당신은 한국 대학교 외국인 유학생 지원 담당자입니다. 아래 질문에 대해 한국어로 간결한 답변을 작성하세요. 비자, 학사, 장학금, 생활 정보 등 유학생이 필요로 하는 실질적인 정보를 포함하세요. 300자 이내로 작성하세요.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const answer = response.choices[0].message.content?.trim();
    if (answer) {
      console.log(`[Search] HyDE generated (${language}→ko): "${answer.substring(0, 80)}..."`);
      return answer;
    }
    return query;
  } catch (error) {
    console.error('[Search] HyDE generation failed, using original query:', error);
    return query;
  }
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
  const { language = 'ko' } = options;

  // Load RAG settings for this university
  const ragSettings = await getRagSettings(universityId);

  // Options passed directly take priority over rag_settings, which take priority over defaults
  const topK = options.topK ?? ragSettings.top_k;
  const threshold = options.threshold ?? ragSettings.match_threshold;
  const hydeEnabled = ragSettings.hyde_enabled;

  console.log(`[Search] Settings: topK=${topK}, threshold=${threshold}, hyde=${hydeEnabled}`);

  // Determine search query: HyDE or translation
  let searchQuery: string;
  if (hydeEnabled && language !== 'ko') {
    searchQuery = await generateHypotheticalAnswer(query, language);
  } else if (language !== 'ko') {
    searchQuery = await translateToKorean(query, language);
    console.log(`[Search] Translated: "${query}" → "${searchQuery}"`);
  } else {
    searchQuery = query;
  }

  const queryEmbedding = await generateEmbedding(searchQuery);
  console.log(`[Search] Query embedding length: ${queryEmbedding.length}`);

  // Always use service role client for RPC functions
  const supabase = createDirectClient();

  console.log(`[Search] Calling RPC with universityId: ${universityId}, topK: ${topK}`);

  // Format embedding as PostgreSQL vector literal: [0.1,0.2,...]
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  console.log(`[Search] Embedding first 200 chars: ${embeddingStr.substring(0, 200)}`);

  // Try RPC with match_threshold first; if migration not applied, fallback to old signature
  let data;
  let error;

  ({ data, error } = await supabase.rpc('match_documents', {
    query_embedding: embeddingStr,
    match_count: topK,
    filter_university_id: universityId,
    match_threshold: threshold,
  }));

  // Fallback: if RPC fails (e.g. match_threshold param not yet in DB), retry without it
  if (error) {
    console.warn('[Search] RPC with match_threshold failed, retrying without it:', error.message);
    ({ data, error } = await supabase.rpc('match_documents', {
      query_embedding: embeddingStr,
      match_count: topK,
      filter_university_id: universityId,
    }));
  }

  if (error) {
    console.error('[Search] RPC error:', error);
    console.error('[Search] RPC error details:', JSON.stringify(error));
    return [];
  }

  console.log(`[Search] RPC returned ${data?.length ?? 0} results`);

  // Apply client-side threshold filtering (always needed as fallback)
  const results = (data || [])
    .filter((result) => result.similarity >= threshold)
    .map((result) => ({
      id: result.id,
      content: result.content,
      metadata: (result.metadata ?? {}) as Record<string, unknown>,
      similarity: result.similarity,
    }));

  console.log(`[Search] Results: ${results.length} after threshold(${threshold})`);
  if (data && data.length > 0 && results.length > 0) {
    console.log(`[Search] Top similarity: ${results[0].similarity?.toFixed(3)}`);
  } else if (data && data.length > 0) {
    console.log(`[Search] All below threshold. Top similarity: ${data[0].similarity?.toFixed(3)}`);
  }

  // Hybrid search: always run keyword search and merge with vector results.
  // Keyword matches ensure exact name/term hits are never missed by vector search.
  const keywordResults = await keywordSearch(searchQuery, universityId, topK);
  const existingIds = new Set(results.map((r) => r.id));
  let addedCount = 0;
  for (const kr of keywordResults) {
    if (!existingIds.has(kr.id)) {
      results.push(kr);
      existingIds.add(kr.id);
      addedCount++;
    }
  }
  if (addedCount > 0) {
    console.log(`[Search] Hybrid: added ${addedCount} keyword results, total: ${results.length}`);
  }

  // Sort merged results: vector results first (higher similarity), then keyword results
  results.sort((a, b) => b.similarity - a.similarity);

  // Limit to topK
  return results.slice(0, topK);
}

/**
 * Keyword-based search as a fallback/supplement to vector search.
 * Extracts key nouns from the query and searches document_chunks using ILIKE.
 */
async function keywordSearch(
  query: string,
  universityId: string,
  limit: number
): Promise<SearchResult[]> {
  // Extract meaningful keywords (2+ chars, skip common particles/suffixes)
  const stopWords = new Set([
    '은', '는', '이', '가', '을', '를', '에', '에서', '의', '와', '과', '로', '으로',
    '도', '만', '까지', '부터', '에게', '한테', '께', '보다', '처럼', '같이',
    '하는', '되는', '있는', '없는', '하다', '되다', '있다', '없다', '인가요',
    '무엇', '어떤', '어떻게', '언제', '어디', '누구', '왜', '얼마',
    '대해', '관해', '대한', '관한', '경우', '때', '것', '수',
  ]);

  const keywords = query
    .replace(/[?.,!~\s]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  if (keywords.length === 0) return [];

  console.log(`[Search] Keyword search with: ${keywords.join(', ')}`);

  const supabase = createDirectClient();

  // Build OR conditions for each keyword
  const conditions = keywords.map((kw) => `content.ilike.%${kw}%`);

  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, content, metadata')
    .eq('university_id', universityId)
    .or(conditions.join(','))
    .limit(limit);

  if (error || !data) {
    console.error('[Search] Keyword search error:', error);
    return [];
  }

  // Score by number of keyword matches
  const scored = data.map((row) => {
    const matchCount = keywords.filter((kw) =>
      row.content.toLowerCase().includes(kw.toLowerCase())
    ).length;
    return {
      id: row.id,
      content: row.content,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      similarity: 0.1 + (matchCount / keywords.length) * 0.2, // synthetic score 0.1-0.3
    };
  });

  // Sort by match count (highest first)
  scored.sort((a, b) => b.similarity - a.similarity);
  console.log(`[Search] Keyword search found ${scored.length} results`);

  return scored.slice(0, limit);
}
