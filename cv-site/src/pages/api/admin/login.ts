import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { AdminLoginPayload, ApiResponse } from '../../../types/index.ts';
import { getAdminConfig, verifyPassword, createSession, setAdminPassword } from '../../../lib/auth.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;

  try {
    const body = (await request.json()) as AdminLoginPayload;

    if (!body.password) {
      return Response.json({ ok: false, error: 'Password is required' } satisfies ApiResponse, { status: 400 });
    }

    let adminConfig = await getAdminConfig(kv);

    // First time setup: if no admin password is set, set it now
    if (!adminConfig) {
      await setAdminPassword(kv, body.password);
      adminConfig = await getAdminConfig(kv);
    }

    const valid = await verifyPassword(body.password, adminConfig!.passwordHash);
    if (!valid) {
      return Response.json({ ok: false, error: 'Invalid password' } satisfies ApiResponse, { status: 401 });
    }

    const sessionToken = await createSession(kv);

    const headers = new Headers({ 'Content-Type': 'application/json' });
    // Set new session cookie with Path=/
    headers.append('Set-Cookie', `admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
    // Expire legacy cookie that had Path=/admin (browsers treat different paths as different cookies)
    headers.append('Set-Cookie', `admin_session=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ ok: false, error: 'Internal error' } satisfies ApiResponse, { status: 500 });
  }
};
