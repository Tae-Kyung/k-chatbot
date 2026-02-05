import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import { processDocument } from '@/lib/rag/pipeline';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return errorResponse('URL is required');
    }

    try {
      new URL(url);
    } catch {
      return errorResponse('Invalid URL format');
    }

    const supabase = await createServiceClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .insert({
        university_id: auth.profile.university_id,
        file_name: url,
        file_type: 'url',
        storage_path: null,
        status: 'pending',
        metadata: { source_url: url },
      })
      .select()
      .single();

    if (error || !doc) {
      return errorResponse('Failed to create document record', 500);
    }

    // Process the URL asynchronously
    try {
      await processDocument(doc.id, auth.profile.university_id);
    } catch {
      // Processing errors are tracked in the document status
    }

    return successResponse(doc, 201);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
