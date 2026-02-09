import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import type { Database } from '@/types/database';

type RagSettingsInsert = Database['public']['Tables']['rag_settings']['Insert'];

const ALLOWED_MODELS = ['text-embedding-3-small', 'text-embedding-3-large'];

const DEFAULT_SETTINGS = {
  embedding_model: 'text-embedding-3-small',
  top_k: 8,
  match_threshold: 0.15,
  rerank_enabled: false,
  hyde_enabled: false,
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const supabase = await createServiceClient();
    const universityId = auth.profile.university_id;

    const { data, error } = await supabase
      .from('rag_settings')
      .select('*')
      .eq('university_id', universityId)
      .single();

    if (error || !data) {
      // Return defaults if no settings exist yet
      return successResponse({
        ...DEFAULT_SETTINGS,
        university_id: universityId,
      });
    }

    return successResponse(data);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const universityId = auth.profile.university_id;

    // Validate inputs
    const { embedding_model, top_k, match_threshold, hyde_enabled, rerank_enabled } = body;

    if (embedding_model !== undefined && !ALLOWED_MODELS.includes(embedding_model)) {
      return errorResponse(`Invalid embedding_model. Allowed: ${ALLOWED_MODELS.join(', ')}`);
    }

    if (top_k !== undefined && (typeof top_k !== 'number' || top_k < 1 || top_k > 20)) {
      return errorResponse('top_k must be a number between 1 and 20');
    }

    if (
      match_threshold !== undefined &&
      (typeof match_threshold !== 'number' || match_threshold < 0 || match_threshold > 1)
    ) {
      return errorResponse('match_threshold must be a number between 0 and 1');
    }

    if (hyde_enabled !== undefined && typeof hyde_enabled !== 'boolean') {
      return errorResponse('hyde_enabled must be a boolean');
    }

    if (rerank_enabled !== undefined && typeof rerank_enabled !== 'boolean') {
      return errorResponse('rerank_enabled must be a boolean');
    }

    const supabase = await createServiceClient();

    const updateData: RagSettingsInsert = {
      university_id: universityId,
      updated_at: new Date().toISOString(),
    };

    if (embedding_model !== undefined) updateData.embedding_model = embedding_model;
    if (top_k !== undefined) updateData.top_k = top_k;
    if (match_threshold !== undefined) updateData.match_threshold = match_threshold;
    if (hyde_enabled !== undefined) updateData.hyde_enabled = hyde_enabled;
    if (rerank_enabled !== undefined) updateData.rerank_enabled = rerank_enabled;

    const { data, error } = await supabase
      .from('rag_settings')
      .upsert(updateData, { onConflict: 'university_id' })
      .select()
      .single();

    if (error) {
      console.error('[Settings] Upsert error:', error);
      return errorResponse('Failed to save settings');
    }

    return successResponse(data);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
