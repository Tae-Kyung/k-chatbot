import OpenAI from 'openai';

/**
 * Create a new OpenAI client instance.
 * Lazily initialized (function, not module-level const) to avoid build errors
 * when OPENAI_API_KEY is not available at import time.
 */
export function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
