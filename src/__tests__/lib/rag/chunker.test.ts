import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/rag/chunker';

describe('chunkText', () => {
  it('should return empty array for empty text', () => {
    const result = chunkText('');
    expect(result).toEqual([]);
  });

  it('should return single chunk for short text', () => {
    const text = 'This is a short text.';
    const result = chunkText(text);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(text);
  });

  it('should split long text into multiple chunks', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`).join(' ');
    const result = chunkText(words, { chunkSize: 100, chunkOverlap: 10 });
    expect(result.length).toBeGreaterThan(1);
  });

  it('should include chunk metadata', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const result = chunkText(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((chunk) => {
      expect(chunk.metadata).toHaveProperty('chunkIndex');
      expect(chunk.metadata).toHaveProperty('startChar');
      expect(chunk.metadata).toHaveProperty('endChar');
    });
  });

  it('should respect chunkSize parameter', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const result = chunkText(words, { chunkSize: 50, chunkOverlap: 5 });
    result.forEach((chunk) => {
      const wordCount = chunk.content.split(/\s+/).length;
      expect(wordCount).toBeLessThanOrEqual(75); // 50 * 1.5
    });
  });

  it('should handle text with only one paragraph', () => {
    const text = 'A single paragraph without any double newlines just words flowing together continuously.';
    const result = chunkText(text);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(text);
  });
});
