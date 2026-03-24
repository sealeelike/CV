import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

// Public endpoint — serves avatar images stored in R2 under avatars/ prefix
export const GET: APIRoute = async ({ request }) => {
  const r2 = env.R2 as R2Bucket;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key || key.includes('..') || key.includes('/')) {
    return new Response('Bad Request', { status: 400 });
  }

  const obj = await r2.get(`avatars/${key}`);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  const contentType = obj.httpMetadata?.contentType ?? 'image/jpeg';
  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
