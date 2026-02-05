import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { errorResponse } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('university_id', auth.profile.university_id)
      .single();

    if (error || !doc) {
      return errorResponse('Document not found', 404);
    }

    if (!doc.storage_path) {
      return errorResponse('This document has no downloadable file', 400);
    }

    // Create a signed URL (valid for 60 seconds)
    const { data: signedUrl, error: signError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60);

    if (signError || !signedUrl) {
      return errorResponse('Failed to generate download URL', 500);
    }

    // Redirect to the signed URL with download header
    const downloadUrl = `${signedUrl.signedUrl}&download=${encodeURIComponent(doc.file_name)}`;
    return Response.redirect(downloadUrl, 302);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
