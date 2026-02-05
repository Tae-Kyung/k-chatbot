import type { BotConfig } from './types';

const BOT_CONFIGS: Record<string, { envKey: string; universityId: string }> = {
  cbnu: {
    envKey: 'TELEGRAM_BOT_TOKEN_CBNU',
    universityId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  },
  knut: {
    envKey: 'TELEGRAM_BOT_TOKEN_KNUT',
    universityId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  },
  knue: {
    envKey: 'TELEGRAM_BOT_TOKEN_KNUE',
    universityId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  },
};

export function getBotConfig(botId: string): BotConfig | null {
  const config = BOT_CONFIGS[botId];
  if (!config) return null;

  const token = process.env[config.envKey];
  if (!token) return null;

  return {
    botId,
    token,
    universityId: config.universityId,
  };
}

export function getWebhookSecret(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || '';
}

export function getAllBotIds(): string[] {
  return Object.keys(BOT_CONFIGS);
}
