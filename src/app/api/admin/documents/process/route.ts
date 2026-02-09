import { NextRequest } from 'next/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import { processDocument } from '@/lib/rag/pipeline';

export const maxDuration = 300; // 5 minutes for Vision mode processing
export const preferredRegion = 'icn1'; // Seoul — Korean university sites block non-Korean IPs

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { documentId, useVision = false } = body;

    if (!documentId) {
      return errorResponse('Document ID required');
    }

    const result = await processDocument(documentId, auth.profile.university_id, { useVision });
    return successResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    return errorResponse(message, 500);
  }
}
