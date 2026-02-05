export const locales = ['ko', 'en', 'zh', 'vi', 'mn', 'km'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';
