import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Create a Supabase client with the service role key (bypasses RLS).
 * Use this for server-side operations that don't go through Next.js cookies
 * (e.g., RAG pipeline, Telegram handler, background jobs).
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
