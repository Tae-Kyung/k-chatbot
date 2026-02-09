import type { SearchResult } from '@/lib/rag/search';

export type DeduplicatedSource = {
  [key: string]: string | number;
  title: string;
  similarity: number;
};

/**
 * Deduplicate search results by file_name, keeping the highest similarity score.
 * Returns an array of { title, similarity } objects.
 */
export function deduplicateSources(searchResults: SearchResult[]): DeduplicatedSource[] {
  if (searchResults.length === 0) return [];

  const sourceMap = new Map<string, number>();
  for (const r of searchResults) {
    const title = r.metadata?.file_name || 'Document';
    if (!sourceMap.has(title) || sourceMap.get(title)! < r.similarity) {
      sourceMap.set(title, r.similarity);
    }
  }
  return Array.from(sourceMap.entries()).map(([title, similarity]) => ({
    title,
    similarity,
  }));
}
