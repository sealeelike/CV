import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse, CVData } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { getCVData, setCVData } from '../../../lib/kv.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const cvData = await getCVData(kv);

  return Response.json({ ok: true, data: { cv: cvData } } satisfies ApiResponse);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = (await request.json()) as { cv: CVData };

  if (!body.cv) {
    return Response.json({ ok: false, error: 'CV data is required' } satisfies ApiResponse, { status: 400 });
  }

  await setCVData(kv, body.cv);

  return Response.json({ ok: true } satisfies ApiResponse);
};
