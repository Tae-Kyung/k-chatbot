import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, SupportedLanguage } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  language: SupportedLanguage;
  error: string | null;

  addMessage: (role: ChatMessage['role'], content: string, sources?: ChatMessage['sources']) => void;
  setLoading: (loading: boolean) => void;
  setLanguage: (lang: SupportedLanguage) => void;
  setError: (error: string | null) => void;
  setConversationId: (id: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversationId: null,
  isLoading: false,
  language: 'ko',
  error: null,

  addMessage: (role, content, sources) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: uuidv4(),
          role,
          content,
          sources,
          createdAt: new Date(),
        },
      ],
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setLanguage: (language) => set({ language }),
  setError: (error) => set({ error }),
  setConversationId: (conversationId) => set({ conversationId }),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.findLastIndex((m) => m.role === 'assistant');
      if (lastIndex >= 0) {
        messages[lastIndex] = { ...messages[lastIndex], content };
      }
      return { messages };
    }),

  resetChat: () =>
    set({
      messages: [],
      conversationId: null,
      isLoading: false,
      error: null,
    }),
}));
