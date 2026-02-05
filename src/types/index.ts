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
