'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
  onFeedback?: (messageId: string, rating: number) => void;
}

export function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<number | null>(null);
  const isUser = message.role === 'user';

  const handleFeedback = (rating: number) => {
    setFeedbackGiven(rating);
    onFeedback?.(message.id, rating);
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-[var(--color-primary,#0066CC)] text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        ) : (
          <div className="prose prose-sm max-w-none text-gray-800 prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-strong:text-gray-900 prose-a:text-blue-600 prose-a:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 border-t border-gray-200 pt-2">
            <p className="mb-1 text-xs font-medium text-gray-500">참고 자료</p>
            <ul className="space-y-0.5">
              {message.sources.map((source, idx) => (
                <li key={idx} className="text-xs text-gray-500">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-700"
                    >
                      {source.title}
                    </a>
                  ) : (
                    source.title
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isUser && onFeedback && (
          <div className="mt-2 flex items-center gap-2 border-t border-gray-200 pt-2">
            {feedbackGiven !== null ? (
              <span className="text-xs text-gray-400">피드백 감사합니다!</span>
            ) : (
              <>
                <button
                  onClick={() => handleFeedback(5)}
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-green-600"
                  title="도움이 됐어요"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleFeedback(1)}
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-red-600"
                  title="아쉬워요"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        <div className="mt-1 text-right">
          <span className={`text-[10px] ${isUser ? 'text-white/60' : 'text-gray-400'}`}>
            {message.createdAt.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
