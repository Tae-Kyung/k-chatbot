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
 * Parse PDF using GPT-4 Vision - better for tables and complex layouts
 */
async function parsePDFWithVision(buffer: Buffer, maxPages: number): Promise<string> {
  const { pdf } = await import('pdf-to-img');

  const pages: string[] = [];
  let pageNum = 0;

  // Convert PDF pages to images
  const pdfDocument = await pdf(buffer, { scale: 2.0 });

  for await (const image of pdfDocument) {
    if (pageNum >= maxPages) {
      console.log(`[Parser] Vision: Stopping at page ${maxPages} (limit)`);
      break;
    }

    const base64Image = Buffer.from(image).toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    try {
      const openai = getOpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `이 PDF 페이지의 내용을 추출해주세요. 다음 규칙을 따르세요:
1. 테이블이 있으면 마크다운 테이블 형식으로 변환하세요.
2. 각 행과 열의 데이터를 정확하게 유지하세요.
3. 테이블 외의 텍스트도 모두 포함하세요.
4. 원본의 구조와 순서를 유지하세요.
5. 추가 설명 없이 내용만 출력하세요.`,
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0,
      });

      const pageContent = response.choices[0].message.content || '';
      if (pageContent.trim()) {
        pages.push(`[페이지 ${pageNum + 1}]\n${pageContent}`);
      }
      console.log(`[Parser] Vision: Page ${pageNum + 1} processed (${pageContent.length} chars)`);
    } catch (error) {
      console.error(`[Parser] Vision: Page ${pageNum + 1} failed:`, error);
    }

    pageNum++;
  }

  if (pages.length === 0) {
    throw new Error('Vision parsing failed: No content extracted');
  }

  return pages.join('\n\n');
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
