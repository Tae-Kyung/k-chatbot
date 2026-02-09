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
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useTheme } from '@/features/university/ThemeProvider';
import { useStreamChat } from '@/hooks/useStreamChat';
import { getWelcomeMessage } from '@/config/messages';
import type { University } from '@/types/database';
import type { SupportedLanguage } from '@/types';

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
    addMessage,
    setLanguage,
    resetChat,
  } = useChatStore();

  const { sendMessage } = useStreamChat(universityId);

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
      addMessage('assistant', getWelcomeMessage(language, university.name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [university]);

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
      addMessage('assistant', getWelcomeMessage(language, university.name));
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
        <LoadingSpinner />
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
                  ? 'Nhập câu hỏi của bạn...'
                  : language === 'mn'
                    ? 'Асуултаа бичнэ үү...'
                    : 'សរសេរសំណួររបស់អ្នក...'
        }
      />

      {university.messenger_links && (
        <MessengerLinks links={university.messenger_links} />
      )}
    </div>
  );
}
