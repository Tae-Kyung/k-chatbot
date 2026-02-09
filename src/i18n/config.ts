import { LOCALE_CODES, DEFAULT_LANGUAGE } from '@/config/constants';

export const locales = LOCALE_CODES;
export type Locale = (typeof LOCALE_CODES)[number];
export const defaultLocale: Locale = DEFAULT_LANGUAGE;
