'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useChatStore } from '@/features/chat/store';
import { ChatMessage } from '@/features/chat/ChatMessage';
import { ChatInput } from '@/features/chat/ChatInput';
import { TypingIndicator } from '@/components/TypingIndicator';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useStreamChat } from '@/hooks/useStreamChat';
import { getWelcomeMessage } from '@/config/messages';
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
    addMessage,
    setLanguage,
  } = useChatStore();

  const { sendMessage } = useStreamChat(universityId);

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
      addMessage('assistant', getWelcomeMessage(language, university.name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [university]);

  if (pageLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <LoadingSpinner className="h-6 w-6" />
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
