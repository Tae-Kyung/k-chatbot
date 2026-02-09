import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

function createDirectClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { query, universityId } = await request.json();
    if (!query || !universityId) {
      return NextResponse.json({ error: 'query and universityId required' }, { status: 400 });
    }

    const supabase = createDirectClient();
    const debug: Record<string, unknown> = { query, universityId };

    // Step 1: Parse keywords
    const stopWords = new Set([
      '은', '는', '이', '가', '을', '를', '에', '에서', '의', '와', '과', '로', '으로',
      '도', '만', '까지', '부터', '에게', '한테', '께', '보다', '처럼', '같이',
      '하는', '되는', '있는', '없는', '하다', '되다', '있다', '없다', '인가요',
      '무엇', '어떤', '어떻게', '언제', '어디', '누구', '왜', '얼마',
      '대해', '관해', '대한', '관한', '경우', '때', '것', '수',
    ]);

    const genericWords = new Set([
      '충북대', '충북대학교', '대학교', '대학', '학교', '한국', '서울',
      '교통대', '교원대', '한국교통대학교', '한국교원대학교',
      '학생', '교수', '직원', '규정', '안내', '정보', '문의',
      '전화번호', '번호', '이메일', '메일', '주소', '연락처',
      '알려줘', '알려주세요', '알려', '알고', '싶어요',
      '방법', '절차', '일정', '비용', '가격', '위치',
      '날짜', '날짜는', '시기', '기간', '시간', '내용',
    ]);

    const PARTICLES = /[은는이가을를의로도만]+$/;

    const allKeywords = query
      .replace(/[?.,!~\s]+/g, ' ')
      .split(' ')
      .map((w: string) => w.trim())
      .filter((w: string) => w.length >= 2 && !stopWords.has(w));

    const specificKeywords = allKeywords.filter((w: string) => {
      if (genericWords.has(w)) return false;
      const stripped = w.replace(PARTICLES, '');
      if (stripped.length >= 2 && genericWords.has(stripped)) return false;
      return true;
    });
    const searchKeywords = specificKeywords.length > 0 ? specificKeywords : allKeywords;

    debug.allKeywords = allKeywords;
    debug.specificKeywords = specificKeywords;
    debug.searchKeywords = searchKeywords;

    // Step 2: AND query
    let andResults: unknown[] = [];
    let andError: string | null = null;
    if (searchKeywords.length >= 2) {
      let andQuery = supabase
        .from('document_chunks')
        .select('id, metadata')
        .eq('university_id', universityId);
      for (const kw of searchKeywords) {
        andQuery = andQuery.ilike('content', `%${kw}%`);
      }
      const { data, error } = await andQuery.limit(8);
      andResults = data || [];
      andError = error?.message || null;
    }
    debug.andResults = andResults.length;
    debug.andError = andError;
    debug.andSample = (andResults as { id: string; metadata: unknown }[]).slice(0, 3).map(r => ({
      id: r.id,
      file_name: (r.metadata as { file_name?: string })?.file_name,
    }));

    // Step 3: OR query
    const conditions = searchKeywords.map((kw: string) => `content.ilike.%${kw}%`);
    const { data: orData, error: orError } = await supabase
      .from('document_chunks')
      .select('id, metadata')
      .eq('university_id', universityId)
      .or(conditions.join(','))
      .limit(32);

    debug.orResults = orData?.length ?? 0;
    debug.orError = orError?.message || null;
    debug.orSample = (orData || []).slice(0, 5).map((r: { id: string; metadata: unknown }) => ({
      id: r.id,
      file_name: (r.metadata as { file_name?: string })?.file_name,
    }));

    // Step 4: Direct SQL test via RPC (simple count)
    const { data: countData, error: countError } = await supabase.rpc('match_documents', {
      query_embedding: '[' + new Array(1536).fill(0).join(',') + ']',
      match_count: 1,
      filter_university_id: universityId,
      match_threshold: 0,
    });
    debug.rpcTest = { count: countData?.length ?? 0, error: countError?.message };

    return NextResponse.json(debug);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
