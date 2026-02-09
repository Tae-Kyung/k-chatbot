export * from './database';

export type SupportedLanguage = 'ko' | 'en' | 'zh' | 'vi' | 'mn' | 'km';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  sources?: { title: string; url?: string }[];
  createdAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Metadata stored on each document_chunk row */
export interface ChunkMetadata {
  file_name?: string;
  chunk_index?: number;
  [key: string]: string | number | undefined;
}

/** Metadata stored on each document row */
export interface DocumentMetadata {
  chunk_count?: number;
  text_length?: number;
  processed_at?: string;
  page_title?: string;
  source_url?: string;
  error?: string;
  [key: string]: string | number | undefined;
}
