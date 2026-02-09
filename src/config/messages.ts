import type { SupportedLanguage } from '@/types';

/**
 * Welcome message templates with {university} placeholder.
 */
export const WELCOME_MESSAGES: Record<SupportedLanguage, string> = {
  ko: '{university}에 오신 것을 환영합니다! 무엇을 도와드릴까요?',
  en: 'Welcome to {university}! How can I help you?',
  zh: '欢迎来到{university}！需要什么帮助？',
  vi: 'Chào mừng đến {university}! Tôi có thể giúp gì cho bạn?',
  mn: '{university}-д тавтай морил! Би танд юугаар туслах вэ?',
  km: 'សូមស្វាគមន៍មកកាន់ {university}! តើខ្ញុំអាចជួយអ្វីបាន?',
};

export function getWelcomeMessage(language: SupportedLanguage, universityName: string): string {
  return (WELCOME_MESSAGES[language] || WELCOME_MESSAGES.ko).replace('{university}', universityName);
}
