import { NextRequest, NextResponse } from 'next/server';
import { getBotConfig, getWebhookSecret } from '@/lib/telegram/config';
import { handleTelegramMessage } from '@/lib/telegram/handler';
import type { TelegramUpdate } from '@/lib/telegram/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;

    // Validate bot config
    const botConfig = getBotConfig(botId);
    if (!botConfig) {
      return NextResponse.json({ error: 'Invalid bot' }, { status: 404 });
    }

    // Verify webhook secret
    const secret = getWebhookSecret();
    if (secret) {
      const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const update: TelegramUpdate = await request.json();

    // Only process messages with text
    if (update.message?.text) {
      // Process in the background - Telegram expects a quick 200 response
      // But since we're on serverless, we need to await
      await handleTelegramMessage(update.message, botConfig);
    }

    // Telegram expects 200 OK
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}
