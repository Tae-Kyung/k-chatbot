import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return errorResponse('Content is required');
    }

    const supabase = await createServiceClient();

    // Verify message belongs to admin's university
    const { data: message } = await supabase
      .from('messages')
      .select(`
        id,
        conversations!inner (
          university_id
        )
      `)
      .eq('id', id)
      .eq('conversations.university_id', auth.profile.university_id)
      .single();

    if (!message) {
      return errorResponse('Message not found', 404);
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ content })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return errorResponse('Failed to update message', 500);
    }

    return successResponse(data);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
