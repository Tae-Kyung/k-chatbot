import { generateEmbedding } from '../embeddings';
import { createServiceRoleClient } from '@/lib/supabase/service';
import type { ChunkMetadata } from '@/types';
import { getRagSettings } from './settings';
import { generateHypotheticalAnswer, translateToKorean } from './hyde';
import { keywordSearch } from './keyword';
import { extractRelevantContent } from './excerpt';

export interface SearchResult {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  similarity: number;
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
  const supabase = createServiceRoleClient();

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
      metadata: (result.metadata ?? {}) as ChunkMetadata,
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
  const newKeywordResults: SearchResult[] = [];
  for (const kr of keywordResults) {
    if (!existingIds.has(kr.id)) {
      newKeywordResults.push(kr);
      existingIds.add(kr.id);
    }
  }

  // Deduplicate keyword results by file_name: keep only best chunk per source.
  // This ensures diverse sources get slots instead of one source filling all slots.
  const bestByFile = new Map<string, SearchResult>();
  for (const kr of newKeywordResults) {
    const fileName = kr.metadata?.file_name || kr.id;
    const existing = bestByFile.get(fileName);
    if (!existing || kr.similarity > existing.similarity) {
      bestByFile.set(fileName, kr);
    }
  }
  const dedupedKeywordResults = Array.from(bestByFile.values());
  dedupedKeywordResults.sort((a, b) => b.similarity - a.similarity);

  if (dedupedKeywordResults.length > 0) {
    console.log(`[Search] Hybrid: ${dedupedKeywordResults.length} unique-source keyword results to merge`);
  }

  // Reserve at least 2 slots for keyword results so they're never fully pushed out
  const reservedKeyword = Math.min(dedupedKeywordResults.length, 2);
  const vectorSlots = topK - reservedKeyword;
  const merged = [
    ...results.slice(0, vectorSlots),
    ...dedupedKeywordResults.slice(0, reservedKeyword),
    ...results.slice(vectorSlots),
    ...dedupedKeywordResults.slice(reservedKeyword),
  ];

  // Limit to topK
  const finalResults = merged.slice(0, topK);

  // Extract relevant excerpts from large chunks to help LLM focus
  return extractRelevantContent(finalResults, searchQuery);
}
