import type { SupportedLanguage } from '@/types';

export const SUPPORTED_LANGUAGES: {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}[] = [
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { code: 'vi', label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
  { code: 'mn', label: 'Mongolian', nativeLabel: 'Монгол' },
  { code: 'km', label: 'Khmer', nativeLabel: 'ភាសាខ្មែរ' },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ko';

export const CHAT_CATEGORIES = [
  { id: 'visa', labelKey: 'chat.category.visa' },
  { id: 'academic', labelKey: 'chat.category.academic' },
  { id: 'career', labelKey: 'chat.category.career' },
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const CHUNK_SIZE = 500; // tokens
export const CHUNK_OVERLAP = 50; // tokens
export const TOP_K_RESULTS = 5;
