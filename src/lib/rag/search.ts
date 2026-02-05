import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { generateEmbedding } from './embeddings';

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

export async function searchDocuments(
  query: string,
  universityId: string,
  options: { topK?: number; threshold?: number; useDirect?: boolean } = {}
): Promise<SearchResult[]> {
  const { topK = 5, threshold = 0.3, useDirect = false } = options;

  const queryEmbedding = await generateEmbedding(query);

  const supabase = useDirect ? createDirectClient() : await createServiceClient();

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    filter_university_id: universityId,
  });

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return (data || [])
    .filter((result) => result.similarity >= threshold)
    .map((result) => ({
      id: result.id,
      content: result.content,
      metadata: (result.metadata ?? {}) as Record<string, unknown>,
      similarity: result.similarity,
    }));
}
