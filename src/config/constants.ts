import type { SupportedLanguage } from '@/types';

// --- Language ---

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

export const LOCALE_CODES = SUPPORTED_LANGUAGES.map(l => l.code);

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ko';

export const CHAT_CATEGORIES = [
  { id: 'visa', labelKey: 'chat.category.visa' },
  { id: 'academic', labelKey: 'chat.category.academic' },
  { id: 'career', labelKey: 'chat.category.career' },
] as const;

// --- Chat / LLM ---

export const MAX_MESSAGE_LENGTH = 1000;
export const CONVERSATION_HISTORY_LIMIT = 6;
export const LLM_MODEL = 'gpt-4o-mini';
export const LLM_TEMPERATURE = 0.3;
export const LLM_MAX_TOKENS_CHAT = 1000;

// --- RAG Pipeline ---

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const CHUNK_SIZE = 500;
export const CHUNK_OVERLAP = 50;
export const TOP_K_RESULTS = 5;
export const EMBEDDING_BATCH_SIZE = 100;
export const EMBEDDING_MAX_INPUT_LENGTH = 8000;
export const AI_RESTRUCTURE_MAX_SEGMENT = 12_000;
export const PIPELINE_INSERT_BATCH_SIZE = 50;
export const MAX_TABLES_TO_PROCESS = 10;
export const VISION_MAX_TEXT_LENGTH = 30_000;

// --- RAG Search ---

export const RAG_SETTINGS_CACHE_TTL_MS = 60_000;
export const EXCERPT_THRESHOLD = 800;
export const EXCERPT_CONTEXT_CHARS = 80;

// --- Crawl ---

export const CRAWL_TIMEOUT_MS = 15_000;

// --- Admin ---

export const ADMIN_POLLING_INTERVAL_MS = 5_000;
