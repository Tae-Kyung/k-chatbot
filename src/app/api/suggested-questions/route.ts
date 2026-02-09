import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const universityId = request.nextUrl.searchParams.get('universityId');
    if (!universityId) {
      return errorResponse('universityId is required');
    }

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('rag_settings')
      .select('suggested_questions')
      .eq('university_id', universityId)
      .single();

    if (error || !data) {
      return successResponse([]);
    }

    return successResponse(data.suggested_questions ?? []);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
