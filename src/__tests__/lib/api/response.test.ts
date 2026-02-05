import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '@/lib/api/response';

describe('API Response helpers', () => {
  describe('successResponse', () => {
    it('should return success response with data', async () => {
      const response = successResponse({ id: 1, name: 'test' });
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ id: 1, name: 'test' });
      expect(response.status).toBe(200);
    });

    it('should accept custom status code', async () => {
      const response = successResponse({ created: true }, 201);
      expect(response.status).toBe(201);
    });
  });

  describe('errorResponse', () => {
    it('should return error response with message', async () => {
      const response = errorResponse('Something went wrong');
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Something went wrong');
      expect(response.status).toBe(400);
    });

    it('should accept custom status code', async () => {
      const response = errorResponse('Not found', 404);
      expect(response.status).toBe(404);
    });
  });
});
