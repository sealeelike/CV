import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;
  const r2 = env.R2 as R2Bucket;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  // List all files in the files/ prefix
  const list = await r2.list({ prefix: 'files/' });
  const files = list.objects.map((obj) => ({
    key: obj.key.replace('files/', ''),
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
    etag: obj.etag,
  }));

  return Response.json({ ok: true, data: { files } } satisfies ApiResponse);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;
  const r2 = env.R2 as R2Bucket;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return Response.json({ ok: false, error: 'No file provided' } satisfies ApiResponse, { status: 400 });
  }

  const key = `files/${file.name}`;
  const arrayBuffer = await file.arrayBuffer();

  await r2.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({
    ok: true,
    data: { key: file.name, size: file.size },
  } satisfies ApiResponse);
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;
  const r2 = env.R2 as R2Bucket;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = (await request.json()) as { key: string };
  if (!body.key) {
    return Response.json({ ok: false, error: 'File key is required' } satisfies ApiResponse, { status: 400 });
  }

  await r2.delete(`files/${body.key}`);

  return Response.json({ ok: true } satisfies ApiResponse);
};
