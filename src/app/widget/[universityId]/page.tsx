'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useChatStore } from '@/features/chat/store';
import { ChatMessage } from '@/features/chat/ChatMessage';
import { ChatInput } from '@/features/chat/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import type { University } from '@/types/database';
import type { SupportedLanguage } from '@/types';

export default function WidgetPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const universityId = params.universityId as string;
  const initialLang = (searchParams.get('lang') as SupportedLanguage) || 'ko';

  const [university, setUniversity] = useState<University | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    language,
    conversationId,
    addMessage,
    setLoading,
    setLanguage,
    setConversationId,
    updateLastAssistantMessage,
  } = useChatStore();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    setLanguage(initialLang);
  }, [initialLang, setLanguage]);

  useEffect(() => {
    async function fetchUniversity() {
      const supabase = createClient();
      const { data } = await supabase
        .from('universities')
        .select('*')
        .eq('id', universityId)
        .single();
      if (data) {
        setUniversity(data);
        document.documentElement.style.setProperty('--color-primary', data.primary_color);
        document.documentElement.style.setProperty('--color-secondary', data.secondary_color);
      }
      setPageLoading(false);
    }
    fetchUniversity();
  }, [universityId]);

  useEffect(() => {
    if (university && messages.length === 0) {
      const welcomeMessages: Record<SupportedLanguage, string> = {
        ko: `${university.name}에 오신 것을 환영합니다! 무엇을 도와드릴까요?`,
        en: `Welcome to ${university.name}! How can I help you?`,
        zh: `欢迎来到${university.name}！需要什么帮助？`,
        vi: `Chào mừng đến ${university.name}! Tôi có thể giúp gì cho bạn?`,
        mn: `${university.name}-д тавтай морил! Би танд юугаар туслах вэ?`,
        km: `សូមស្វាគមន៍មកកាន់ ${university.name}! តើខ្ញុំអាចជួយអ្វីបាន?`,
      };
      addMessage('assistant', welcomeMessages[language] || welcomeMessages['ko']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [university]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;
    addMessage('user', content);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ universityId, message: content, language, conversationId }),
      });

      if (!response.ok) throw new Error('Failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      addMessage('assistant', '');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter((l) => l.startsWith('data:'));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.type === 'meta') setConversationId(data.conversationId);
            else if (data.type === 'content') {
              updateLastAssistantMessage(
                (messages[messages.length - 1]?.content || '') + data.content
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      addMessage('assistant', '오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!university) {
    return <div className="flex h-screen items-center justify-center text-gray-500 text-sm">University not found</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ backgroundColor: university.primary_color }}>
        <h1 className="text-sm font-semibold text-white">{university.name} AI Guide</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
