import { describe, it, expect } from 'vitest';
import { parseHTML } from '@/lib/rag/parser';

describe('parseHTML', () => {
  it('should extract text from simple HTML', async () => {
    const html = '<html><body><p>Hello World</p></body></html>';
    const result = await parseHTML(html);
    expect(result).toContain('Hello World');
  });

  it('should remove script and style tags', async () => {
    const html = `
      <html>
        <body>
          <script>alert('xss')</script>
          <style>.hidden { display: none }</style>
          <p>Visible content</p>
        </body>
      </html>
    `;
    const result = await parseHTML(html);
    expect(result).toContain('Visible content');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('display');
  });

  it('should remove navigation elements', async () => {
    const html = `
      <html>
        <body>
          <nav><a href="/">Home</a><a href="/about">About</a></nav>
          <main><p>Main content here</p></main>
          <footer>Footer text</footer>
        </body>
      </html>
    `;
    const result = await parseHTML(html);
    expect(result).toContain('Main content');
    expect(result).not.toContain('Footer text');
  });

  it('should prefer main/article content', async () => {
    const html = `
      <html>
        <body>
          <div>Sidebar stuff</div>
          <main><article><p>Article content</p></article></main>
        </body>
      </html>
    `;
    const result = await parseHTML(html);
    expect(result).toContain('Article content');
  });

  it('should clean whitespace', async () => {
    const html = '<html><body><p>  Multiple   spaces   here  </p></body></html>';
    const result = await parseHTML(html);
    expect(result).not.toContain('  ');
  });
});
