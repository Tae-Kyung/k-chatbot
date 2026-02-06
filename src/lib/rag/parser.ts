import * as cheerio from 'cheerio';
import path from 'path';
import { pathToFileURL } from 'url';
import { applyDOMPolyfills } from './dommatrix-polyfill';
import OpenAI from 'openai';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface ParsePDFOptions {
  useVision?: boolean; // Use GPT-4 Vision for table-heavy PDFs
  maxPages?: number;   // Max pages to process with Vision (default: 10)
}

export async function parsePDF(buffer: Buffer, options: ParsePDFOptions = {}): Promise<string> {
  const { useVision = false, maxPages = 10 } = options;

  if (useVision) {
    return parsePDFWithVision(buffer, maxPages);
  }

  return parsePDFWithText(buffer);
}

/**
 * Parse PDF using GPT-4 for table restructuring
 * Extracts text and uses AI to format tables properly
 */
async function parsePDFWithVision(buffer: Buffer, maxPages: number): Promise<string> {
  // First, extract raw text using standard method
  const rawText = await parsePDFWithText(buffer);

  console.log(`[Parser] Vision: Extracted ${rawText.length} chars, sending to GPT-4 for restructuring`);

  // Use GPT-4 to restructure the text, especially tables
  const openai = getOpenAI();

  // Split into chunks if too long (GPT-4 context limit)
  const maxChunkSize = 12000;
  const chunks: string[] = [];

  if (rawText.length <= maxChunkSize) {
    chunks.push(rawText);
  } else {
    // Split by double newlines to preserve paragraphs
    const paragraphs = rawText.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + '\n\n' + para).length > maxChunkSize && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }

  console.log(`[Parser] Vision: Processing ${chunks.length} chunks`);

  const processedChunks: string[] = [];

  for (let i = 0; i < Math.min(chunks.length, maxPages); i++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 PDF에서 추출된 텍스트를 정리하는 전문가입니다.
다음 규칙을 따르세요:
1. 테이블 데이터가 있으면 마크다운 테이블 형식으로 변환하세요.
2. 행과 열의 관계를 파악하여 정확하게 구조화하세요.
3. 원본 내용을 그대로 유지하되, 읽기 쉽게 정리하세요.
4. 추가 설명이나 주석 없이 정리된 내용만 출력하세요.`,
          },
          {
            role: 'user',
            content: `다음 PDF 텍스트를 정리해주세요. 특히 테이블이 있다면 마크다운 테이블로 변환해주세요:\n\n${chunks[i]}`,
          },
        ],
        max_tokens: 4000,
        temperature: 0,
      });

      const processed = response.choices[0].message.content || chunks[i];
      processedChunks.push(processed);
      console.log(`[Parser] Vision: Chunk ${i + 1}/${chunks.length} processed`);
    } catch (error) {
      console.error(`[Parser] Vision: Chunk ${i + 1} failed:`, error);
      processedChunks.push(chunks[i]); // Use original on failure
    }
  }

  return processedChunks.join('\n\n');
}

/**
 * Parse PDF using text extraction - fast but loses table structure
 */
async function parsePDFWithText(buffer: Buffer): Promise<string> {
  // Polyfill DOMMatrix/DOMPoint/DOMRect for serverless environments (Vercel)
  // where @napi-rs/canvas native module is unavailable
  applyDOMPolyfills();

  const { PDFParse } = await import('pdf-parse');

  // Use path.join with process.cwd() — works on Vercel with serverExternalPackages
  const workerPath = pathToFileURL(
    path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  ).href;
  PDFParse.setWorker(workerPath);

  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const result = await parser.getText();
  await parser.destroy();

  // Remove page separator lines (e.g. "-- 1 of 5 --")
  const text = result.text.replace(/\n--\s*\d+\s+of\s+\d+\s*--\n/g, '\n');
  return cleanText(text);
}

export async function parseHTML(html: string): Promise<string> {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, nav, footer, header, aside, .sidebar, .menu, .navigation').remove();

  // Try to get main content
  const mainContent = $('main, article, .content, .post, #content, #main').first();
  const text = mainContent.length > 0 ? mainContent.text() : $('body').text();

  return cleanText(text);
}

export async function crawlURL(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'K-Student-AI-Guide-Bot/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/pdf')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return parsePDF(buffer);
  }

  const html = await response.text();
  return parseHTML(html);
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
