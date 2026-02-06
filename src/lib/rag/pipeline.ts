import { createClient } from '@supabase/supabase-js';
import { parsePDF, crawlURL, type ParsePDFOptions } from './parser';
import { chunkText } from './chunker';
import { generateEmbeddings } from './embeddings';

export interface ProcessOptions {
  useVision?: boolean; // Use GPT-4 Vision for table-heavy PDFs
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function processDocument(
  documentId: string,
  universityId: string,
  options: ProcessOptions = {}
) {
  const { useVision = false } = options;
  const supabase = getServiceClient();

  // Update status to processing
  await supabase
    .from('documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  try {
    // Get document info
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message || 'no data'}`);
    }

    console.log(`[Pipeline] Processing: ${doc.file_name} (type: ${doc.file_type})`);

    let text = '';

    if (doc.file_type === 'url') {
      // Crawl URL
      const metadata = doc.metadata as { source_url?: string } | null;
      const url = metadata?.source_url || doc.file_name;
      text = await crawlURL(url);
    } else if (doc.storage_path) {
      // Download from storage
      console.log(`[Pipeline] Downloading from storage: ${doc.storage_path}`);
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message || 'no data'}`);
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      console.log(`[Pipeline] Downloaded ${buffer.length} bytes`);

      if (doc.file_type === 'application/pdf' || doc.file_name.endsWith('.pdf')) {
        console.log(`[Pipeline] Parsing PDF... (useVision: ${useVision})`);
        text = await parsePDF(buffer, { useVision });
        console.log(`[Pipeline] PDF parsed, text length: ${text.length}`);
      } else {
        // Fallback: treat as plain text
        text = buffer.toString('utf-8');
      }
    } else if (doc.file_type === 'qa') {
      // Q&A type - already processed inline
      return { success: true, chunks: 0 };
    } else {
      throw new Error(`Unsupported file type: ${doc.file_type}`);
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text content extracted from document. The file may be a scanned image PDF.');
    }

    // Chunk the text
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error('No chunks generated from text');
    }

    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    // Store chunks with embeddings
    const chunkRecords = chunks.map((chunk, i) => ({
      document_id: documentId,
      university_id: universityId,
      content: chunk.content,
      metadata: {
        file_name: doc.file_name,
        chunk_index: chunk.metadata.chunkIndex,
      },
      embedding: JSON.stringify(embeddings[i]),
    }));

    // Insert in batches of 50
    const insertBatchSize = 50;
    for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
      const batch = chunkRecords.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert chunks batch ${i}: ${insertError.message}`);
      }
    }

    // Update status to completed
    await supabase
      .from('documents')
      .update({
        status: 'completed',
        metadata: {
          chunk_count: chunks.length,
          text_length: text.length,
          processed_at: new Date().toISOString(),
        },
      })
      .eq('id', documentId);

    return { success: true, chunks: chunks.length };
  } catch (error) {
    // Update status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('documents')
      .update({
        status: 'failed',
        metadata: { error: errorMessage },
      })
      .eq('id', documentId);

    throw error;
  }
}
