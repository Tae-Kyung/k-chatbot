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
async function parsePDFWithVision(buffer: Buffer, _maxPages: number): Promise<string> {
  // First, extract raw text using standard method
  const rawText = await parsePDFWithText(buffer);

  console.log(`[Parser] Vision: Extracted ${rawText.length} chars`);

  // If text is too long, skip AI restructuring (would take too long/cost too much)
  const maxTextLength = 30000;
  if (rawText.length > maxTextLength) {
    console.log(`[Parser] Vision: Text too long (${rawText.length} > ${maxTextLength}), using raw text`);
    return rawText;
  }

  // Use GPT-4 to restructure the text in a single call
  console.log(`[Parser] Vision: Sending to GPT-4 for table restructuring`);

  try {
    const openai = getOpenAI();
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
          content: `다음 PDF 텍스트를 정리해주세요. 특히 테이블이 있다면 마크다운 테이블로 변환해주세요:\n\n${rawText}`,
        },
      ],
      max_tokens: 8000,
      temperature: 0,
    });

    const processed = response.choices[0].message.content || rawText;
    console.log(`[Parser] Vision: Restructuring complete (${processed.length} chars)`);
    return processed;
  } catch (error) {
    console.error(`[Parser] Vision: GPT-4 failed, using raw text:`, error);
    return rawText; // Fallback to raw text on failure
  }
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

  // Convert HTML tables to markdown BEFORE text extraction
  // Without this, cheerio .text() concatenates cell values without spaces:
  //   <td>산학협력단장</td><td>043-261-XXXX</td> → "산학협력단장043-261-XXXX"
  $('table').each((_, table) => {
    const rows: string[][] = [];
    $(table).find('tr').each((_, tr) => {
      const cells: string[] = [];
      $(tr).find('th, td').each((_, cell) => {
        const text = $(cell).text().trim().replace(/\s+/g, ' ');
        cells.push(text);
      });
      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    if (rows.length === 0) return;

    // Determine max column count
    const colCount = Math.max(...rows.map((r) => r.length));

    // Build markdown table
    const mdRows = rows.map((row) => {
      const padded = [...row];
      while (padded.length < colCount) padded.push('');
      return `| ${padded.join(' | ')} |`;
    });

    // Insert separator after first row (header)
    if (mdRows.length > 1) {
      const sep = `| ${Array(colCount).fill('---').join(' | ')} |`;
      mdRows.splice(1, 0, sep);
    }

    $(table).replaceWith(`\n\n${mdRows.join('\n')}\n\n`);
  });

  // Try to get main content — expanded selectors for Korean university sites
  const mainContent = $(
    'main, article, .content, .post, #content, #main, ' +
    '.sub_content, .board_view, #bo_v, .view_content, .bbs_content, ' +
    '.page-content, .entry-content, #container'
  ).first();
  const text = mainContent.length > 0 ? mainContent.text() : $('body').text();

  return cleanText(text);
}

export async function crawlURL(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
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
