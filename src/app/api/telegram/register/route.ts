import { NextRequest } from 'next/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getBotConfig, getWebhookSecret, getAllBotIds } from '@/lib/telegram/config';
import { setWebhook } from '@/lib/telegram/api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { botId } = body;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return errorResponse('NEXT_PUBLIC_APP_URL not configured', 500);
    }

    const secret = getWebhookSecret();
    const botIds = botId ? [botId] : getAllBotIds();
    const results: { botId: string; success: boolean; error?: string }[] = [];

    for (const id of botIds) {
      const config = getBotConfig(id);
      if (!config) {
        results.push({ botId: id, success: false, error: 'No token configured' });
        continue;
      }

      const webhookUrl = `${appUrl}/api/telegram/webhook/${id}`;
      const res = await setWebhook(config.token, webhookUrl, secret || undefined);

      results.push({
        botId: id,
        success: res.ok,
        error: res.ok ? undefined : res.description,
      });
    }

    return successResponse(results);
  } catch {
    return errorResponse('Failed to register webhooks', 500);
  }
}
