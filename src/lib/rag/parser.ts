import * as cheerio from 'cheerio';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

export async function parsePDF(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');

  // Use require.resolve for portable path resolution (works on Vercel)
  const require2 = createRequire(import.meta.url);
  const workerPath = pathToFileURL(
    require2.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
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
