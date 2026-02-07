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
  top_k: 5,
  match_threshold: 0.3,
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

  return results;
}
