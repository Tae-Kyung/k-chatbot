import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Build chat messages array from conversation history + system prompt.
 * Fetches recent messages (limited to `limit`) in chronological order.
 */
export async function buildChatMessages(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  systemPrompt: string,
  limit = 6
): Promise<ChatMessage[]> {
  const { data: allHistory } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Reverse to chronological order (fetched in desc order to get the latest)
  const history = (allHistory || []).reverse();

  return [
    { role: 'system', content: systemPrompt },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];
}
