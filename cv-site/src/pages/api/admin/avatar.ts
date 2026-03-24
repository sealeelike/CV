import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';

// Upload an avatar image to R2 avatars/ prefix
export const POST: APIRoute = async ({ request }) => {
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

  if (!file.type.startsWith('image/')) {
    return Response.json({ ok: false, error: 'Only image files are allowed' } satisfies ApiResponse, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ ok: false, error: 'File too large (max 2MB)' } satisfies ApiResponse, { status: 400 });
  }

  // Use a unique key to avoid collisions: timestamp + original name
  const ext = file.name.split('.').pop() ?? 'jpg';
  const key = `${Date.now()}.${ext}`;

  await r2.put(`avatars/${key}`, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const avatarUrl = `/api/avatar?key=${key}`;
  return Response.json({ ok: true, data: { url: avatarUrl } } satisfies ApiResponse);
};
