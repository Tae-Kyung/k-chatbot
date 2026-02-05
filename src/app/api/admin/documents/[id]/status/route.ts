import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('documents')
      .select('id, status, metadata')
      .eq('id', id)
      .eq('university_id', auth.profile.university_id)
      .single();

    if (error || !data) {
      return errorResponse('Document not found', 404);
    }

    return successResponse(data);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
