import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { getMessages, markMessageRead } from '../../../lib/db.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const db = env.DB as D1Database;
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const messages = await getMessages(db, limit, offset);

  return Response.json({ ok: true, data: { messages } } satisfies ApiResponse);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const db = env.DB as D1Database;
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = (await request.json()) as { messageId: number; read: boolean };
  if (body.read) {
    await markMessageRead(db, body.messageId);
  }

  return Response.json({ ok: true } satisfies ApiResponse);
};
