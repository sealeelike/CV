import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../types/index.ts';
import { validateMagicLink } from '../../lib/magic-link.ts';
import { insertLinkAccess } from '../../lib/db.ts';

export const GET: APIRoute = async ({ request, locals, redirect }) => {
  const db = env.DB as D1Database;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.json({ ok: false, error: 'Token is required' } satisfies ApiResponse, { status: 400 });
  }

  const result = await validateMagicLink(db, token);

  if (!result.valid) {
    return new Response(
      `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
        <div style="text-align:center">
          <h1>Link Invalid or Expired</h1>
          <p>This magic link is no longer valid.</p>
        </div>
      </body></html>`,
      { status: 403, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Log access server-side before redirect
  try {
    await insertLinkAccess(db, {
      magicLinkId: result.linkId!,
      ip: request.headers.get('CF-Connecting-IP') ?? undefined,
      userAgent: request.headers.get('User-Agent') ?? undefined,
      geoCountry: request.headers.get('CF-IPCountry') ?? undefined,
      geoCity: request.headers.get('CF-IPCity') ?? undefined,
    });
  } catch (e) {
    console.error('insertLinkAccess failed:', e);
  }

  // Set a cookie to indicate valid magic link access
  const headers = new Headers();
  headers.set('Set-Cookie', `magic_link=${result.linkId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
  headers.set('Location', '/');
  return new Response(null, { status: 302, headers });
};
