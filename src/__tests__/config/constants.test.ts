import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, CHAT_CATEGORIES, MAX_FILE_SIZE, CHUNK_SIZE, CHUNK_OVERLAP, TOP_K_RESULTS } from '@/config/constants';

describe('Constants', () => {
  it('should have 6 supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(6);
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('ko');
    expect(codes).toContain('en');
    expect(codes).toContain('zh');
    expect(codes).toContain('vi');
    expect(codes).toContain('mn');
    expect(codes).toContain('km');
  });

  it('should have Korean as default language', () => {
    expect(DEFAULT_LANGUAGE).toBe('ko');
  });

  it('should have 3 chat categories', () => {
    expect(CHAT_CATEGORIES).toHaveLength(3);
    const ids = CHAT_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('visa');
    expect(ids).toContain('academic');
    expect(ids).toContain('career');
  });

  it('should have reasonable chunk parameters', () => {
    expect(CHUNK_SIZE).toBe(500);
    expect(CHUNK_OVERLAP).toBe(50);
    expect(CHUNK_OVERLAP).toBeLessThan(CHUNK_SIZE);
  });

  it('should have 10MB max file size', () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it('should retrieve top 5 results', () => {
    expect(TOP_K_RESULTS).toBe(5);
  });
});
