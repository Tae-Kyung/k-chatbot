import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = await createServiceClient();

    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('university_id', auth.profile.university_id);

    if (search) {
      query = query.ilike('file_name', `%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return errorResponse('Failed to fetch documents', 500);
    }

    return successResponse({
      documents: data,
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch {
    return errorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const supabase = getServiceClient();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('No file provided');
    }

    const allowedTypes = ['application/pdf', 'application/x-hwp'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.hwp')) {
      return errorResponse('Only PDF and HWP files are supported');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return errorResponse('File size exceeds 10MB limit');
    }

    // Upload to Supabase Storage (use safe filename for storage path)
    const ext = file.name.split('.').pop() || 'pdf';
    const safeFileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `${auth.profile.university_id}/${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return errorResponse(`Failed to upload file: ${uploadError.message}`, 500);
    }

    // Create document record
    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        university_id: auth.profile.university_id,
        file_name: file.name,
        file_type: file.type || 'application/pdf',
        storage_path: storagePath,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      return errorResponse(`Failed to create document record: ${dbError.message}`, 500);
    }

    return successResponse(doc, 201);
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
