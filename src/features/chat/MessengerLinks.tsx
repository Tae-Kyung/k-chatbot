'use client';

import { useState, useRef, useEffect } from 'react';
import type { Json } from '@/types/database';

interface MessengerLinksProps {
  links: Json;
}

interface MessengerConfig {
  kakao?: string;
  wechat?: string;
  telegram?: string;
}

export function MessengerLinks({ links }: MessengerLinksProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const messengerLinks = (links as MessengerConfig) ?? {};

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableLinks = Object.entries(messengerLinks).filter(
    ([, url]) => url
  );

  if (availableLinks.length === 0) return null;

  const messengerInfo: Record<string, { label: string; color: string }> = {
    kakao: { label: 'KakaoTalk', color: '#FEE500' },
    wechat: { label: 'WeChat', color: '#07C160' },
    telegram: { label: 'Telegram', color: '#0088CC' },
  };

  return (
    <div ref={popoverRef} className="fixed bottom-24 right-4 z-40">
      {isOpen && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          {availableLinks.map(([key, url]) => {
            const info = messengerInfo[key];
            if (!info || !url) return null;
            return (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: info.color }}
                />
                {info.label}
              </a>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary,#0066CC)] text-white shadow-lg transition-transform hover:scale-105"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
    </div>
  );
}
