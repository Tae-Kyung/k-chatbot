import { createClient } from '@supabase/supabase-js';
import { parsePDF, crawlURL } from './parser';
import { chunkText } from './chunker';
import { generateEmbeddings } from './embeddings';
import {
  classifyDocument,
  getChunkOverlap,
  preprocessByLanguage,
} from './language';
import OpenAI from 'openai';

export interface ProcessOptions {
  useVision?: boolean; // Use GPT-4 Vision for table-heavy PDFs
}

interface ChunkStrategy {
  chunkSize?: number;
  chunkOverlap?: number;
  separator?: string;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Extract and summarize markdown tables from text using GPT-4o-mini.
 * Returns additional chunks with table summaries for better retrieval.
 */
async function summarizeTables(
  text: string,
  fileName: string
): Promise<{ content: string; metadata: { chunkIndex: number; startChar: number; endChar: number } }[]> {
  // Match markdown-style tables
  const tableRegex = /(\|[^\n]+\|\n\|[-: |]+\|\n(?:\|[^\n]+\|\n?)+)/g;
  const tables: string[] = [];
  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    tables.push(match[1]);
  }

  if (tables.length === 0) return [];

  // Limit to 10 tables
  const tablesToProcess = tables.slice(0, 10);
  const summaryChunks: { content: string; metadata: { chunkIndex: number; startChar: number; endChar: number } }[] = [];

  const openai = getOpenAI();

  for (let i = 0; i < tablesToProcess.length; i++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '주어진 표를 한국어 자연어 문장으로 요약하세요. 핵심 정보(날짜, 금액, 조건 등)를 모두 포함하되 500토큰 이내로 작성하세요.',
          },
          { role: 'user', content: tablesToProcess[i] },
        ],
        temperature: 0,
        max_tokens: 500,
      });

      const summary = response.choices[0].message.content?.trim();
      if (summary) {
        summaryChunks.push({
          content: `[표 요약 - ${fileName}] ${summary}`,
          metadata: {
            chunkIndex: 9000 + i, // High index to avoid collision
            startChar: 0,
            endChar: 0,
          },
        });
      }
    } catch (error) {
      console.error(`[Pipeline] Table summary ${i} failed:`, error);
    }
  }

  return summaryChunks;
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

    // 5. Update status to completed with language and doc_type
    await supabase
      .from('documents')
      .update({
        status: 'completed',
        language: docLanguage,
        doc_type: docType,
        metadata: {
          chunk_count: allChunks.length,
          text_length: text.length,
          processed_at: new Date().toISOString(),
        },
      })
      .eq('id', documentId);

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
