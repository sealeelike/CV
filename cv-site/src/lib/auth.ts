import type { AdminConfig } from '../types/index.ts';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 24; // 24 hours

/**
 * Hash a password using Web Crypto API (available in Workers)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  // Constant-time comparison
  if (inputHash.length !== storedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < inputHash.length; i++) {
    mismatch |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Create a session token and store in KV
 */
export async function createSession(kv: KVNamespace): Promise<string> {
  const token = crypto.randomUUID();
  await kv.put(`${SESSION_PREFIX}${token}`, JSON.stringify({ createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL,
  });
  return token;
}

/**
 * Validate a session token
 */
export async function validateSession(kv: KVNamespace, token: string): Promise<boolean> {
  if (!token) return false;
  const session = await kv.get(`${SESSION_PREFIX}${token}`);
  return session !== null;
}

/**
 * Delete a session token
 */
export async function deleteSession(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(`${SESSION_PREFIX}${token}`);
}

/**
 * Extract session token from cookie header
 */
export function getSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Admin auth middleware helper - validates request has valid session
 */
export async function requireAdmin(request: Request, kv: KVNamespace): Promise<boolean> {
  const cookie = request.headers.get('Cookie');
  const token = getSessionFromCookie(cookie);
  if (!token) return false;
  return validateSession(kv, token);
}

/**
 * Get or initialize admin config
 */
export async function getAdminConfig(kv: KVNamespace): Promise<AdminConfig | null> {
  const raw = await kv.get('config:admin');
  if (!raw) return null;
  return JSON.parse(raw) as AdminConfig;
}

/**
 * Set admin password
 */
export async function setAdminPassword(kv: KVNamespace, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await kv.put('config:admin', JSON.stringify({ passwordHash }));
}
