import { parsePDF, crawlURL } from './parser';
import { chunkText } from './chunker';
import { generateEmbeddings } from './embeddings';
import {
  classifyDocument,
  getChunkOverlap,
  preprocessByLanguage,
} from './language';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { PIPELINE_INSERT_BATCH_SIZE } from '@/config/constants';
import type { DocumentMetadata } from '@/types';
import { restructureWithAI } from './pipeline-restructure';
import { summarizeTables } from './pipeline-tables';

export interface ProcessOptions {
  useVision?: boolean; // Use GPT-4 Vision for table-heavy PDFs
}

interface ChunkStrategy {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

export async function processDocument(
  documentId: string,
  universityId: string,
  options: ProcessOptions = {}
) {
  const { useVision = false } = options;
  const supabase = createServiceRoleClient();

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
    let pageTitle: string | undefined;

    if (doc.file_type === 'url') {
      // Crawl URL
      const metadata = doc.metadata as { source_url?: string } | null;
      const url = metadata?.source_url || doc.file_name;
      const crawlResult = await crawlURL(url);
      text = crawlResult.text;
      pageTitle = crawlResult.title;
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

    // --- Adaptive Processing ---

    // 1. Auto-classify language & doc type (unless already set by admin)
    let docLanguage = doc.language as string | null;
    let docType = doc.doc_type as string | null;

    if (!docLanguage || !docType) {
      console.log('[Pipeline] Auto-classifying document...');
      const classification = await classifyDocument(text.substring(0, 2000));
      docLanguage = docLanguage || classification.language;
      docType = docType || classification.docType;
      console.log(`[Pipeline] Classified: language=${docLanguage}, docType=${docType}`);
    } else {
      console.log(`[Pipeline] Using existing classification: language=${docLanguage}, docType=${docType}`);
    }

    // 2. Apply language-specific preprocessing
    text = preprocessByLanguage(text, docLanguage);

    // 2.5. Restructure table-heavy documents with AI
    if (docType === 'table_heavy' && !useVision && doc.file_type !== 'url') {
      console.log('[Pipeline] Restructuring table-heavy document with AI...');
      text = await restructureWithAI(text);
      console.log(`[Pipeline] Restructured text length: ${text.length}`);
    }

    // 3. Determine adaptive chunking parameters
    const adminStrategy = doc.chunk_strategy as ChunkStrategy | null;
    const chunkSize = adminStrategy?.chunkSize || 500;
    const chunkOverlap = adminStrategy?.chunkOverlap || getChunkOverlap(docLanguage, chunkSize);
    const separator = adminStrategy?.separator || '\n\n';

    console.log(`[Pipeline] Chunking params: size=${chunkSize}, overlap=${chunkOverlap}, separator="${separator}"`);

    // Chunk the text with adaptive parameters
    const chunks = chunkText(text, { chunkSize, chunkOverlap, separator });

    if (chunks.length === 0) {
      throw new Error('No chunks generated from text');
    }

    // 4. Table summarization for table-heavy documents
    let allChunks = [...chunks];
    if (docType === 'table_heavy') {
      console.log('[Pipeline] Generating table summaries...');
      const tableSummaries = await summarizeTables(text, doc.file_name);
      if (tableSummaries.length > 0) {
        console.log(`[Pipeline] Added ${tableSummaries.length} table summary chunks`);
        allChunks = [...allChunks, ...tableSummaries];
      }
    }

    // Generate embeddings in batch
    const embeddings = await generateEmbeddings(allChunks.map((c) => c.content));

    // Store chunks with embeddings
    const chunkRecords = allChunks.map((chunk, i) => ({
      document_id: documentId,
      university_id: universityId,
      content: chunk.content,
      metadata: {
        file_name: doc.file_name,
        chunk_index: chunk.metadata.chunkIndex,
      },
      embedding: JSON.stringify(embeddings[i]),
    }));

    // Insert in batches
    const insertBatchSize = PIPELINE_INSERT_BATCH_SIZE;
    for (let i = 0; i < chunkRecords.length; i += insertBatchSize) {
      const batch = chunkRecords.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert chunks batch ${i}: ${insertError.message}`);
      }
    }

    // 5. Update status to completed with language and doc_type
    const completedMeta: DocumentMetadata = {
      chunk_count: allChunks.length,
      text_length: text.length,
      processed_at: new Date().toISOString(),
    };
    if (pageTitle) {
      completedMeta.page_title = pageTitle;
    }
    // Preserve source_url from original metadata
    const origMeta = doc.metadata as DocumentMetadata | null;
    if (origMeta?.source_url) {
      completedMeta.source_url = origMeta.source_url;
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'completed',
        language: docLanguage,
        doc_type: docType,
        metadata: completedMeta,
      })
      .eq('id', documentId);

    if (updateError) {
      console.warn('[Pipeline] Update with new columns failed, retrying without:', updateError.message);
      await supabase
        .from('documents')
        .update({
          status: 'completed',
          metadata: completedMeta,
        })
        .eq('id', documentId);
    }

    return { success: true, chunks: allChunks.length };
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
