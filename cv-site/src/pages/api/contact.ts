import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ContactPayload, ApiResponse } from '../../types/index.ts';
import { insertMessage } from '../../lib/db.ts';
import { checkTurnstile } from '../../lib/turnstile.ts';
import { notifyNewMessage } from '../../lib/telegram.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = env.DB as D1Database;
  const kv = env.KV as KVNamespace;

  try {
    const body = (await request.json()) as ContactPayload;

    if (!body.content?.trim()) {
      return Response.json({ ok: false, error: 'Message content is required' } satisfies ApiResponse, { status: 400 });
    }

    // Verify turnstile if enabled
    const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
    const turnstileOk = await checkTurnstile(kv, body.turnstileToken, ip);
    if (!turnstileOk) {
      return Response.json({ ok: false, error: 'Human verification failed' } satisfies ApiResponse, { status: 403 });
    }

    const guestId = request.headers.get('X-Guest-Id');

    const message = await insertMessage(db, {
      guestId: guestId ? parseInt(guestId, 10) : undefined,
      name: body.name,
      email: body.email,
      content: body.content.trim(),
    });

    // Notify admin
    notifyNewMessage(kv, {
      name: body.name,
      email: body.email,
      content: body.content.trim(),
    }).catch(console.error);

    return Response.json({ ok: true, data: { messageId: message.message_id } } satisfies ApiResponse, { status: 200 });
  } catch (err) {
    console.error('Contact error:', err);
    return Response.json({ ok: false, error: 'Internal error' } satisfies ApiResponse, { status: 500 });
  }
};
