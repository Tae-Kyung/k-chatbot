import { useChatStore } from '@/features/chat/store';

/**
 * Shared SSE streaming logic for chat and widget pages.
 * Returns a sendMessage function that handles fetch + SSE parsing.
 */
export function useStreamChat(universityId: string) {
  const {
    isLoading,
    language,
    conversationId,
    addMessage,
    setLoading,
    setConversationId,
    updateLastAssistantMessage,
  } = useChatStore();

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    addMessage('user', content);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universityId,
          message: content,
          language,
          conversationId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      addMessage('assistant', '');
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter((line) => line.startsWith('data:'));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(5).trim());

            if (data.type === 'meta') {
              setConversationId(data.conversationId);
            } else if (data.type === 'content') {
              fullContent += data.content;
              // Strip any followups marker that LLM may emit
              const display = fullContent.replace(/\s*<!--followups:\[[\s\S]*?\]-->\s*$/, '').trimEnd();
              updateLastAssistantMessage(display);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch {
      addMessage(
        'assistant',
        language === 'ko'
          ? '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.'
          : 'Sorry, an error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage };
}
