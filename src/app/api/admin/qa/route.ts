import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import { generateEmbedding, generateEmbeddings } from '@/lib/rag/embeddings';
import { chunkText } from '@/lib/rag/chunker';

export const maxDuration = 60;

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

    try {
      const fullContent = `질문: ${question}\n답변: ${answer}`;

      // Short content: single chunk (like before)
      if (fullContent.length <= 2000) {
        const embedding = await generateEmbedding(fullContent);

        await supabase.from('document_chunks').insert({
          document_id: doc.id,
          university_id: auth.profile.university_id,
          content: fullContent,
          metadata: { type: 'qa', question, file_name: `Q&A: ${question.substring(0, 50)}` },
          embedding: JSON.stringify(embedding),
        });
      } else {
        // Long content: chunk the answer and prepend question context to each chunk
        const chunks = chunkText(answer, { chunkSize: 500, chunkOverlap: 50 });

        const chunkContents = chunks.map(
          (c, i) => `질문: ${question}\n답변 (${i + 1}/${chunks.length}): ${c.content}`
        );

        const embeddings = await generateEmbeddings(chunkContents);

        // Insert chunks in batches of 50
        const batchSize = 50;
        for (let i = 0; i < chunkContents.length; i += batchSize) {
          const batch = chunkContents.slice(i, i + batchSize).map((content, j) => ({
            document_id: doc.id,
            university_id: auth.profile.university_id,
            content,
            metadata: {
              type: 'qa',
              question,
              file_name: `Q&A: ${question.substring(0, 50)}`,
              chunk_index: i + j,
            },
            embedding: JSON.stringify(embeddings[i + j]),
          }));

          const { error: insertError } = await supabase
            .from('document_chunks')
            .insert(batch);

          if (insertError) {
            throw new Error(`Failed to insert chunks: ${insertError.message}`);
          }
        }
      }

      await supabase
        .from('documents')
        .update({
          status: 'completed',
          metadata: { chunk_count: fullContent.length <= 2000 ? 1 : undefined },
        })
        .eq('id', doc.id);

      return successResponse(doc, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process Q&A';
      await supabase
        .from('documents')
        .update({ status: 'failed', metadata: { error: message } })
        .eq('id', doc.id);

      return errorResponse(message, 500);
    }
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
