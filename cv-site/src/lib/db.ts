import type { Guest, GuestWithMagicLink, FileRequest, Message, MagicLink } from '../types/index.ts';

// ============================================
// Guests
// ============================================
export async function insertGuest(
  db: D1Database,
  data: {
    ip?: string;
    fingerprint?: string;
    fingerprintRaw?: object;
    userAgent?: string;
    geoCountry?: string;
    geoCity?: string;
    magicLinkId?: string;
  }
): Promise<Guest> {
  const result = await db
    .prepare(
      `INSERT INTO guests (ip, fingerprint, fingerprint_raw, user_agent, geo_country, geo_city, magic_link_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      data.ip ?? null,
      data.fingerprint ?? null,
      data.fingerprintRaw ? JSON.stringify(data.fingerprintRaw) : null,
      data.userAgent ?? null,
      data.geoCountry ?? null,
      data.geoCity ?? null,
      data.magicLinkId ?? null
    )
    .first<Guest>();
  return result!;
}

export async function getGuests(
  db: D1Database,
  limit = 50,
  offset = 0
): Promise<GuestWithMagicLink[]> {
  const { results } = await db
    .prepare(
      `SELECT g.*, ml.token AS magic_link_token, ml.label AS magic_link_label
       FROM guests g
       LEFT JOIN magic_links ml ON g.magic_link_id = ml.link_id
       ORDER BY g.consent_time DESC LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<GuestWithMagicLink>();
  return results;
}

export async function getGuestCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as count FROM guests').first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getGuestsByFingerprint(
  db: D1Database,
  fingerprint: string,
  limit = 50,
  offset = 0
): Promise<GuestWithMagicLink[]> {
  const { results } = await db
    .prepare(
      `SELECT g.*, ml.token AS magic_link_token, ml.label AS magic_link_label
       FROM guests g
       LEFT JOIN magic_links ml ON g.magic_link_id = ml.link_id
       WHERE g.fingerprint = ?
       ORDER BY g.consent_time DESC LIMIT ? OFFSET ?`
    )
    .bind(fingerprint, limit, offset)
    .all<GuestWithMagicLink>();
  return results;
}

export async function getGuestCountByFingerprint(db: D1Database, fingerprint: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as count FROM guests WHERE fingerprint = ?').bind(fingerprint).first<{ count: number }>();
  return row?.count ?? 0;
}

function generateTrackingCode(): string {
  // Unambiguous chars (no O/0, I/1 confusion)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = 'REQ-';
  for (const byte of bytes) {
    code += chars[byte % chars.length];
  }
  return code;
}

// ============================================
// File Requests
// ============================================
export async function insertFileRequest(
  db: D1Database,
  data: {
    guestId?: number;
    recipientEmail: string;
    fileList: string[];
  }
): Promise<FileRequest> {
  const trackingCode = generateTrackingCode();
  const result = await db
    .prepare(
      `INSERT INTO file_requests (tracking_code, guest_id, recipient_email, file_list)
       VALUES (?, ?, ?, ?)
       RETURNING *`
    )
    .bind(trackingCode, data.guestId ?? null, data.recipientEmail, JSON.stringify(data.fileList))
    .first<FileRequest>();
  return result!;
}

export async function updateFileRequestStatus(
  db: D1Database,
  requestId: number,
  status: 'pending' | 'sent' | 'failed'
): Promise<void> {
  await db
    .prepare('UPDATE file_requests SET status = ? WHERE request_id = ?')
    .bind(status, requestId)
    .run();
}

export async function getFileRequests(
  db: D1Database,
  limit = 50,
  offset = 0
): Promise<FileRequest[]> {
  const { results } = await db
    .prepare('SELECT * FROM file_requests ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<FileRequest>();
  return results;
}

// ============================================
// Messages
// ============================================
export async function insertMessage(
  db: D1Database,
  data: {
    guestId?: number;
    name?: string;
    email?: string;
    content: string;
  }
): Promise<Message> {
  const result = await db
    .prepare(
      `INSERT INTO messages (guest_id, name, email, content)
       VALUES (?, ?, ?, ?)
       RETURNING *`
    )
    .bind(data.guestId ?? null, data.name ?? null, data.email ?? null, data.content)
    .first<Message>();
  return result!;
}

export async function getMessages(
  db: D1Database,
  limit = 50,
  offset = 0
): Promise<Message[]> {
  const { results } = await db
    .prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<Message>();
  return results;
}

export async function markMessageRead(db: D1Database, messageId: number): Promise<void> {
  await db.prepare('UPDATE messages SET read = 1 WHERE message_id = ?').bind(messageId).run();
}

export async function getUnreadMessageCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as count FROM messages WHERE read = 0').first<{ count: number }>();
  return row?.count ?? 0;
}

// ============================================
// Magic Links
// ============================================
export async function insertMagicLink(
  db: D1Database,
  data: {
    linkId: string;
    token: string;
    label?: string;
    assetId?: string;
    allowedFiles?: string[];
    expiresAt?: string;
    maxUses?: number;
    requireEmail?: boolean;
    variantAssets?: { asset_id: string; label: string }[];
  }
): Promise<MagicLink> {
  const result = await db
    .prepare(
      `INSERT INTO magic_links (link_id, token, label, asset_id, allowed_files, expires_at, max_uses, require_email, variant_assets)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      data.linkId,
      data.token,
      data.label ?? null,
      data.assetId ?? null,
      data.allowedFiles ? JSON.stringify(data.allowedFiles) : null,
      data.expiresAt ?? null,
      data.maxUses ?? null,
      data.requireEmail === false ? 0 : 1,
      data.variantAssets?.length ? JSON.stringify(data.variantAssets) : null
    )
    .first<MagicLink>();
  return result!;
}

export async function getMagicLinkByToken(db: D1Database, token: string): Promise<MagicLink | null> {
  return db.prepare('SELECT * FROM magic_links WHERE token = ?').bind(token).first<MagicLink>();
}

export async function getMagicLinkById(db: D1Database, linkId: string): Promise<MagicLink | null> {
  return db.prepare('SELECT * FROM magic_links WHERE link_id = ?').bind(linkId).first<MagicLink>();
}

export async function incrementMagicLinkUse(db: D1Database, linkId: string): Promise<void> {
  await db.prepare('UPDATE magic_links SET use_count = use_count + 1 WHERE link_id = ?').bind(linkId).run();
}

export async function getMagicLinks(db: D1Database): Promise<MagicLink[]> {
  const { results } = await db
    .prepare('SELECT * FROM magic_links ORDER BY created_at DESC')
    .all<MagicLink>();
  return results;
}

export async function updateMagicLink(
  db: D1Database,
  linkId: string,
  data: {
    label?: string | null;
    assetId?: string | null;
    allowedFiles?: string[] | null;
    expiresAt?: string | null;
    maxUses?: number | null;
    requireEmail?: boolean | null;
    variantAssets?: { asset_id: string; label: string }[] | null;
  }
): Promise<MagicLink | null> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if ('label' in data) { sets.push('label = ?'); values.push(data.label ?? null); }
  if ('assetId' in data) { sets.push('asset_id = ?'); values.push(data.assetId ?? null); }
  if ('allowedFiles' in data) { sets.push('allowed_files = ?'); values.push(data.allowedFiles ? JSON.stringify(data.allowedFiles) : null); }
  if ('expiresAt' in data) { sets.push('expires_at = ?'); values.push(data.expiresAt ?? null); }
  if ('maxUses' in data) { sets.push('max_uses = ?'); values.push(data.maxUses ?? null); }
  if ('requireEmail' in data) { sets.push('require_email = ?'); values.push(data.requireEmail ? 1 : 0); }
  if ('variantAssets' in data) { sets.push('variant_assets = ?'); values.push(data.variantAssets?.length ? JSON.stringify(data.variantAssets) : null); }

  if (sets.length === 0) return null;

  values.push(linkId);
  return db
    .prepare(`UPDATE magic_links SET ${sets.join(', ')} WHERE link_id = ? RETURNING *`)
    .bind(...values)
    .first<MagicLink>();
}

export async function deleteMagicLink(db: D1Database, linkId: string): Promise<void> {
  await db.prepare('DELETE FROM magic_links WHERE link_id = ?').bind(linkId).run();
}
