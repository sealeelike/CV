import { getMagicLinkByToken, incrementMagicLinkUse } from './db.ts';

/**
 * Generate a random token for magic links
 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate a magic link token
 * Returns the link_id if valid, null if invalid
 */
export async function validateMagicLink(
  db: D1Database,
  token: string
): Promise<{ valid: boolean; linkId?: string; label?: string }> {
  const link = await getMagicLinkByToken(db, token);

  if (!link) {
    return { valid: false };
  }

  // Check expiration
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { valid: false };
  }

  // Check max uses
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    return { valid: false };
  }

  // Increment use count
  await incrementMagicLinkUse(db, link.link_id);

  return { valid: true, linkId: link.link_id, label: link.label ?? undefined };
}
