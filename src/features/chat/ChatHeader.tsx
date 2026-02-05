'use client';

import { LanguageSelector } from '@/components/LanguageSelector';
import type { University } from '@/types/database';
import type { SupportedLanguage } from '@/types';

interface ChatHeaderProps {
  university: University;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onNewChat: () => void;
}

export function ChatHeader({
  university,
  language,
  onLanguageChange,
  onNewChat,
}: ChatHeaderProps) {
  return (
    <header
      className="flex items-center justify-between border-b px-4 py-3"
      style={{ backgroundColor: university.primary_color }}
    >
      <div className="flex items-center gap-3">
        {university.logo_url && (
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white">
            <img
              src={university.logo_url}
              alt={university.name}
              className="h-6 w-6 object-contain"
            />
          </div>
        )}
        <h1 className="text-base font-semibold text-white">
          {university.name}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onNewChat}
          className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          title="New Chat"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <LanguageSelector
          currentLanguage={language}
          onLanguageChange={onLanguageChange}
        />
      </div>
    </header>
  );
}
