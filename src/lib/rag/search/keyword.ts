import { createServiceRoleClient } from '@/lib/supabase/service';
import type { ChunkMetadata } from '@/types';
import type { SearchResult } from './index';

const stopWords = new Set([
  '은', '는', '이', '가', '을', '를', '에', '에서', '의', '와', '과', '로', '으로',
  '도', '만', '까지', '부터', '에게', '한테', '께', '보다', '처럼', '같이',
  '하는', '되는', '있는', '없는', '하다', '되다', '있다', '없다', '인가요',
  '무엇', '어떤', '어떻게', '언제', '어디', '누구', '왜', '얼마',
  '대해', '관해', '대한', '관한', '경우', '때', '것', '수',
]);

// Generic words that match too many chunks and drown out specific results
const genericWords = new Set([
  '충북대', '충북대학교', '대학교', '대학', '학교', '한국', '서울',
  '교통대', '교원대', '한국교통대학교', '한국교원대학교',
  '학생', '교수', '직원', '규정', '안내', '정보', '문의',
  // Question-intent words: user's search intent, not content identifiers
  '전화번호', '번호', '이메일', '메일', '주소', '연락처',
  '알려줘', '알려주세요', '알려', '알고', '싶어요',
  '방법', '절차', '일정', '비용', '가격', '위치',
  '날짜', '날짜는', '시기', '기간', '시간', '내용',
]);

const PARTICLES = /[은는이가을를의로도만]+$/;

/**
 * Keyword-based search as a supplement to vector search.
 * Filters out common/generic words and focuses on specific terms (names, technical terms).
 * Uses raw SQL to fetch broadly and score locally by match count.
 */
export async function keywordSearch(
  query: string,
  universityId: string,
  limit: number
): Promise<SearchResult[]> {
  const allKeywords = query
    .replace(/[?.,!~\s]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  // Separate specific keywords (names, terms) from generic ones
  // Also strip common Korean particles for genericWords matching
  const specificKeywords = allKeywords.filter((w) => {
    if (genericWords.has(w)) return false;
    const stripped = w.replace(PARTICLES, '');
    if (stripped.length >= 2 && genericWords.has(stripped)) return false;
    return true;
  });
  const searchKeywords = specificKeywords.length > 0 ? specificKeywords : allKeywords;

  if (searchKeywords.length === 0) return [];

  console.log(`[Search] Keyword search with: ${searchKeywords.join(', ')} (from: ${allKeywords.join(', ')})`);

  const supabase = createServiceRoleClient();

  // Strategy: AND-first (precise), then OR (broad) to fill remaining slots
  const allData: { id: string; content: string; metadata: unknown }[] = [];
  const seenIds = new Set<string>();

  // 1) AND search: chunks matching ALL specific keywords (most relevant)
  if (searchKeywords.length >= 2) {
    let andQuery = supabase
      .from('document_chunks')
      .select('id, content, metadata')
      .eq('university_id', universityId);
    for (const kw of searchKeywords) {
      andQuery = andQuery.ilike('content', `%${kw}%`);
    }
    const { data: andData } = await andQuery.limit(limit);
    if (andData) {
      for (const row of andData) {
        if (!seenIds.has(row.id)) {
          allData.push(row);
          seenIds.add(row.id);
        }
      }
      console.log(`[Search] Keyword AND: ${andData.length} results`);
    }
  }

  // 2) OR search: fill remaining slots with broader matches
  if (allData.length < limit) {
    const conditions = searchKeywords.map((kw) => `content.ilike.%${kw}%`);
    const { data: orData } = await supabase
      .from('document_chunks')
      .select('id, content, metadata')
      .eq('university_id', universityId)
      .or(conditions.join(','))
      .limit(limit * 4);
    if (orData) {
      for (const row of orData) {
        if (!seenIds.has(row.id)) {
          allData.push(row);
          seenIds.add(row.id);
        }
      }
    }
  }

  // Score by how many specific keywords match — avoids generic/intent words inflating scores
  const scored = allData.map((row) => {
    const contentLower = row.content.toLowerCase();
    const specificMatchCount = searchKeywords.filter((kw) =>
      contentLower.includes(kw.toLowerCase())
    ).length;
    // Tiebreaker: count ALL keyword matches (including generic) for secondary ranking
    const totalMatchCount = allKeywords.filter((kw) =>
      contentLower.includes(kw.toLowerCase())
    ).length;
    return {
      id: row.id,
      content: row.content,
      metadata: (row.metadata ?? {}) as ChunkMetadata,
      similarity: 0.3 + (specificMatchCount / searchKeywords.length) * 0.25
        + (totalMatchCount / allKeywords.length) * 0.05, // 0.3-0.6
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  console.log(`[Search] Keyword search: fetched ${allData.length}, scored top: ${scored[0]?.similarity.toFixed(2) ?? 'n/a'}`);

  return scored.slice(0, limit);
}
