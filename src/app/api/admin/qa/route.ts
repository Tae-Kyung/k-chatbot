import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import OpenAI from 'openai';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { question, answer } = body;

    if (!question || !answer) {
      return errorResponse('Question and answer are required');
    }

    const supabase = await createServiceClient();

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        university_id: auth.profile.university_id,
        file_name: `Q&A: ${question.substring(0, 50)}`,
        file_type: 'qa',
        status: 'processing',
      })
      .select()
      .single();

    if (docError || !doc) {
      return errorResponse('Failed to create Q&A record', 500);
    }

    // Generate embedding for the Q&A content
    const content = `질문: ${question}\n답변: ${answer}`;

    try {
      const embeddingResponse = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: content,
      });

      const embedding = embeddingResponse.data[0].embedding;

      await supabase.from('document_chunks').insert({
        document_id: doc.id,
        university_id: auth.profile.university_id,
        content,
        metadata: { type: 'qa', question },
        embedding: JSON.stringify(embedding),
      });

      await supabase
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', doc.id);

      return successResponse(doc, 201);
    } catch {
      await supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', doc.id);

      return errorResponse('Failed to process Q&A', 500);
    }
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
