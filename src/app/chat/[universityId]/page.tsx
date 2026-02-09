'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useChatStore } from '@/features/chat/store';
import { ChatHeader } from '@/features/chat/ChatHeader';
import { ChatMessage } from '@/features/chat/ChatMessage';
import { ChatInput } from '@/features/chat/ChatInput';
import { SuggestedQuestions, type SuggestedQuestion } from '@/features/chat/SuggestedQuestions';
import { MessengerLinks } from '@/features/chat/MessengerLinks';
import { TypingIndicator } from '@/components/TypingIndicator';
import { useTheme } from '@/features/university/ThemeProvider';
import type { University } from '@/types/database';
import type { SupportedLanguage } from '@/types';

const WELCOME_MESSAGES: Record<SupportedLanguage, string> = {
  ko: '{university}에 오신 것을 환영합니다! 무엇을 도와드릴까요?',
  en: 'Welcome to {university}! How can I help you?',
  zh: '欢迎来到{university}！需要什么帮助？',
  vi: 'Ch\u00E0o m\u1EEBng \u0111\u1EBFn {university}! T\u00F4i c\u00F3 th\u1EC3 gi\u00FAp g\u00EC cho b\u1EA1n?',
  mn: '{university}-\u0434 \u0442\u0430\u0432\u0442\u0430\u0439 \u043C\u043E\u0440\u0438\u043B! \u0411\u0438 \u0442\u0430\u043D\u0434 \u044E\u0443\u0433\u0430\u0430\u0440 \u0442\u0443\u0441\u043B\u0430\u0445 \u0432\u044D?',
  km: '\u179F\u17BC\u1798\u179F\u17D2\u179C\u17B6\u1782\u1798\u1793\u17CD\u1798\u1780\u1780\u17B6\u1793\u17CB {university}! \u178F\u17BE\u1781\u17D2\u1789\u17BB\u17C6\u17A2\u17B6\u1785\u1787\u17BD\u1799\u17A2\u17D2\u179C\u17B8\u1794\u17B6\u1793?',
};

export default function ChatPage() {
  const params = useParams();
  const universityId = params.universityId as string;
  const { setUniversity } = useTheme();
  const [university, setUni] = useState<University | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);
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
    resetChat,
  } = useChatStore();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Fetch university data
  useEffect(() => {
    async function fetchUniversity() {
      const supabase = createClient();
      const { data } = await supabase
        .from('universities')
        .select('*')
        .eq('id', universityId)
        .single();

      if (data) {
        setUni(data);
        setUniversity(data);
      }
      setPageLoading(false);
    }
    fetchUniversity();
  }, [universityId, setUniversity]);

  // Fetch suggested questions
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch(`/api/suggested-questions?universityId=${universityId}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSuggestedQuestions(json.data);
        }
      } catch {
        // Silently fail
      }
    }
    fetchQuestions();
  }, [universityId]);

  // Add welcome message on mount
  useEffect(() => {
    if (university && messages.length === 0) {
      const welcome = WELCOME_MESSAGES[language].replace(
        '{university}',
        university.name
      );
      addMessage('assistant', welcome);
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
              updateLastAssistantMessage(fullContent);
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

  const handleFeedback = async (messageId: string, rating: number) => {
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating }),
      });
    } catch {
      // Silently fail for feedback
    }
  };

  const handleNewChat = () => {
    resetChat();
    if (university) {
      const welcome = WELCOME_MESSAGES[language].replace(
        '{university}',
        university.name
      );
      addMessage('assistant', welcome);
    }
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  // Load saved language preference
  useEffect(() => {
    const saved = localStorage.getItem('preferred-language') as SupportedLanguage | null;
    if (saved) {
      setLanguage(saved);
    }
  }, [setLanguage]);

  if (pageLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <svg
          className="h-8 w-8 animate-spin text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  if (!university) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">University not found</p>
        <a href="/" className="text-blue-600 underline">
          Go back
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <ChatHeader
        university={university}
        language={language}
        onLanguageChange={handleLanguageChange}
        onNewChat={handleNewChat}
      />

      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onFeedback={msg.role === 'assistant' ? handleFeedback : undefined}
          />
        ))}
        {messages.length <= 1 && suggestedQuestions.length > 0 && (
          <SuggestedQuestions
            questions={suggestedQuestions}
            onSelect={sendMessage}
          />
        )}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={sendMessage}
        disabled={isLoading}
        placeholder={
          language === 'ko'
            ? '질문을 입력하세요...'
            : language === 'en'
              ? 'Type your question...'
              : language === 'zh'
                ? '请输入问题...'
                : language === 'vi'
                  ? 'Nh\u1EADp c\u00E2u h\u1ECFi c\u1EE7a b\u1EA1n...'
                  : language === 'mn'
                    ? '\u0410\u0441\u0443\u0443\u043B\u0442\u0430\u0430 \u0431\u0438\u0447\u043D\u044D \u04AF\u04AF...'
                    : '\u179F\u179A\u179F\u17C1\u179A\u179F\u17C6\u178E\u17BD\u179A\u179A\u1794\u179F\u17CB\u17A2\u17D2\u1793\u1780...'
        }
      />

      {university.messenger_links && (
        <MessengerLinks links={university.messenger_links} />
      )}
    </div>
  );
}
