import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ConsentPayload, ApiResponse } from '../../types/index.ts';
import { insertGuest } from '../../lib/db.ts';
import { checkTurnstile } from '../../lib/turnstile.ts';
import { notifyNewVisitor } from '../../lib/telegram.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = env.DB as D1Database;
  const kv = env.KV as KVNamespace;

  try {
    const body = (await request.json()) as ConsentPayload;

    // Verify turnstile if enabled
    const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
    const turnstileOk = await checkTurnstile(kv, body.turnstileToken, ip);
    if (!turnstileOk) {
      return Response.json({ ok: false, error: 'Human verification failed' } satisfies ApiResponse, { status: 403 });
    }

    // Extract visitor metadata from Cloudflare headers
    const geoCountry = request.headers.get('CF-IPCountry') ?? undefined;
    const geoCity = request.headers.get('CF-IPCity') ?? undefined;
    const userAgent = request.headers.get('User-Agent') ?? undefined;

    const guest = await insertGuest(db, {
      ip,
      fingerprint: body.fingerprint,
      fingerprintRaw: body.fingerprintRaw,
      userAgent,
      geoCountry,
      geoCity,
      magicLinkId: body.magicLinkId,
    });

    // Notify admin (fire and forget)
    notifyNewVisitor(kv, { ip, country: geoCountry, city: geoCity }).catch(console.error);

    return Response.json({ ok: true, data: { guestId: guest.guest_id } } satisfies ApiResponse, { status: 200 });
  } catch (err) {
    console.error('Consent error:', err);
    return Response.json({ ok: false, error: 'Internal error' } satisfies ApiResponse, { status: 500 });
  }
};
