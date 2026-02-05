import type { TelegramApiResponse } from './types';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const MAX_MESSAGE_LENGTH = 4096;

async function callTelegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>
): Promise<TelegramApiResponse> {
  const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<TelegramApiResponse>;
}

export function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      parts.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIdx = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    if (splitIdx === -1 || splitIdx < MAX_MESSAGE_LENGTH / 2) {
      // Fall back to splitting at a space
      splitIdx = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
    }
    if (splitIdx === -1 || splitIdx < MAX_MESSAGE_LENGTH / 2) {
      // Hard split
      splitIdx = MAX_MESSAGE_LENGTH;
    }

    parts.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return parts;
}

export async function sendMessage(
  token: string,
  chatId: number,
  text: string
): Promise<void> {
  const parts = splitMessage(text);
  for (const part of parts) {
    await callTelegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: part,
      parse_mode: 'Markdown',
    });
  }
}

export async function sendChatAction(
  token: string,
  chatId: number,
  action: 'typing' = 'typing'
): Promise<void> {
  await callTelegramApi(token, 'sendChatAction', {
    chat_id: chatId,
    action,
  });
}

export async function setWebhook(
  token: string,
  url: string,
  secretToken?: string
): Promise<TelegramApiResponse> {
  const body: Record<string, unknown> = { url };
  if (secretToken) {
    body.secret_token = secretToken;
  }
  return callTelegramApi(token, 'setWebhook', body);
}
