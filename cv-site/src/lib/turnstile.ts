import type { TurnstileConfig } from '../types/index.ts';

/**
 * Verify a Turnstile token with Cloudflare's API
 */
export async function verifyTurnstile(secretKey: string, token: string, ip?: string): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  const result = (await response.json()) as { success: boolean };
  return result.success;
}

/**
 * Get turnstile config from KV
 */
export async function getTurnstileConfig(kv: KVNamespace): Promise<TurnstileConfig | null> {
  const raw = await kv.get('config:turnstile');
  if (!raw) return null;
  return JSON.parse(raw) as TurnstileConfig;
}

/**
 * Check turnstile if enabled, return true if passed or disabled
 */
export async function checkTurnstile(
  kv: KVNamespace,
  token: string | undefined,
  ip?: string
): Promise<boolean> {
  const config = await getTurnstileConfig(kv);
  // If turnstile is not configured or disabled, allow through
  if (!config?.enabled) return true;
  // If enabled but no token provided, reject
  if (!token) return false;
  return verifyTurnstile(config.secretKey, token, ip);
}
