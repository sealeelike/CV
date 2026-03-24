import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { getGuests, getGuestCount } from '../../../lib/db.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const db = env.DB as D1Database;
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const [guests, total] = await Promise.all([
    getGuests(db, limit, offset),
    getGuestCount(db),
  ]);

  return Response.json({ ok: true, data: { guests, total, limit, offset } } satisfies ApiResponse);
};
