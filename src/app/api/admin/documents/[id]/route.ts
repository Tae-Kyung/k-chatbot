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
      .select('*')
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const supabase = await createServiceClient();

    // Get document to find storage path
    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('university_id', auth.profile.university_id)
      .single();

    if (!doc) {
      return errorResponse('Document not found', 404);
    }

    // Delete document chunks (vectors)
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', id);

    // Delete from storage
    if (doc.storage_path) {
      await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);
    }

    // Delete document record
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      return errorResponse('Failed to delete document', 500);
    }

    return successResponse({ deleted: true });
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
