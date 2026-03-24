import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse, TelegramConfig, EmailConfig, TurnstileConfig, AccessConfig } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { getConfig, setConfig } from '../../../lib/kv.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const [telegram, email, turnstile, access] = await Promise.all([
    getConfig<TelegramConfig>(kv, 'config:telegram'),
    getConfig<EmailConfig>(kv, 'config:email'),
    getConfig<TurnstileConfig>(kv, 'config:turnstile'),
    getConfig<AccessConfig>(kv, 'config:access'),
  ]);

  // Mask sensitive values
  const maskedEmail = email
    ? { ...email, resendApiKey: email.resendApiKey ? '***' + email.resendApiKey.slice(-4) : '' }
    : null;
  const maskedTelegram = telegram
    ? { ...telegram, botToken: telegram.botToken ? '***' + telegram.botToken.slice(-4) : '' }
    : null;
  const maskedTurnstile = turnstile
    ? { ...turnstile, secretKey: turnstile.secretKey ? '***' + turnstile.secretKey.slice(-4) : '' }
    : null;

  return Response.json({
    ok: true,
    data: {
      telegram: maskedTelegram,
      email: maskedEmail,
      turnstile: maskedTurnstile,
      access: access ?? { mode: 'open' },
    },
  } satisfies ApiResponse);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = (await request.json()) as {
    section: 'telegram' | 'email' | 'turnstile' | 'access';
    data: unknown;
  };

  const keyMap: Record<string, string> = {
    telegram: 'config:telegram',
    email: 'config:email',
    turnstile: 'config:turnstile',
    access: 'config:access',
  };

  const key = keyMap[body.section];
  if (!key) {
    return Response.json({ ok: false, error: 'Invalid section' } satisfies ApiResponse, { status: 400 });
  }

  // For partial updates, merge with existing config
  const existing = await getConfig(kv, key);
  const merged = existing ? { ...existing, ...(body.data as object) } : body.data;

  await setConfig(kv, key, merged);

  return Response.json({ ok: true } satisfies ApiResponse);
};
