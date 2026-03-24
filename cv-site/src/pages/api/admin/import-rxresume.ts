import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { importFromRxresume } from '../../../lib/rxresume-import.ts';

export const POST: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  let raw: Record<string, any>;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' } satisfies ApiResponse, { status: 400 });
  }

  try {
    const cv = importFromRxresume(raw);
    return Response.json({ ok: true, data: { cv } } satisfies ApiResponse);
  } catch (err) {
    return Response.json(
      { ok: false, error: `Conversion failed: ${(err as Error).message}` } satisfies ApiResponse,
      { status: 400 }
    );
  }
};
