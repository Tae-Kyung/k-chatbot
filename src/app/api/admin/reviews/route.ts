import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        role,
        conversation_id,
        conversations!inner (
          university_id,
          language
        ),
        feedback (
          id,
          rating,
          comment
        )
      `)
      .eq('conversations.university_id', auth.profile.university_id)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return errorResponse('Failed to fetch reviews', 500);
    }

    return successResponse(data);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
