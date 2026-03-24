import type { Asset, CVData, VariantAsset } from '../types/index.ts';

/**
 * Get the default asset (is_default = 1).
 */
export async function getDefaultAsset(db: D1Database): Promise<Asset | null> {
  return db.prepare('SELECT * FROM assets WHERE is_default = 1 LIMIT 1').first<Asset>();
}

/**
 * Get the asset bound to a magic link. Falls back to default asset.
 */
export async function getAssetForMagicLink(db: D1Database, magicLinkId: string): Promise<Asset | null> {
  // Check if this magic link has a bound asset
  const link = await db.prepare(
    'SELECT asset_id FROM magic_links WHERE link_id = ?'
  ).bind(magicLinkId).first<{ asset_id: string | null }>();

  if (link?.asset_id) {
    const asset = await db.prepare(
      'SELECT * FROM assets WHERE asset_id = ?'
    ).bind(link.asset_id).first<Asset>();
    if (asset) return asset;
  }

  // Fallback to default
  return getDefaultAsset(db);
}

/**
 * Resolve asset for a request: if magic link present, try bound asset; else default.
 */
export async function getAssetForRequest(db: D1Database, magicLinkId?: string | null): Promise<Asset | null> {
  if (magicLinkId) {
    return getAssetForMagicLink(db, magicLinkId);
  }
  return getDefaultAsset(db);
}

/**
 * Validate that a variant asset belongs to the magic link, then load it.
 */
export async function getVariantAsset(
  db: D1Database,
  magicLinkId: string,
  variantAssetId: string
): Promise<Asset | null> {
  const link = await db.prepare(
    'SELECT variant_assets FROM magic_links WHERE link_id = ?'
  ).bind(magicLinkId).first<{ variant_assets: string | null }>();
  if (!link?.variant_assets) return null;

  const variants = JSON.parse(link.variant_assets) as VariantAsset[];
  if (!variants.some((v) => v.asset_id === variantAssetId)) return null;

  return db.prepare('SELECT * FROM assets WHERE asset_id = ?')
    .bind(variantAssetId).first<Asset>();
}

/**
 * Get all variant assets for a magic link (for rendering the switcher).
 */
export async function getVariantsForMagicLink(
  db: D1Database,
  magicLinkId: string
): Promise<VariantAsset[]> {
  const link = await db.prepare(
    'SELECT variant_assets FROM magic_links WHERE link_id = ?'
  ).bind(magicLinkId).first<{ variant_assets: string | null }>();
  if (!link?.variant_assets) return [];
  return JSON.parse(link.variant_assets) as VariantAsset[];
}

/**
 * Migrate existing KV cv:content + cv:theme into a default asset (one-time).
 * Returns the new asset if created, or null if migration was skipped (asset already exists).
 */
export async function migrateKVToAsset(
  db: D1Database,
  kv: KVNamespace
): Promise<Asset | null> {
  // Skip if any asset already exists
  const existing = await db.prepare('SELECT asset_id FROM assets LIMIT 1').first();
  if (existing) return null;

  const cvRaw = await kv.get('cv:content');
  if (!cvRaw) return null;

  const themeName = (await kv.get('cv:theme')) ?? 'default';
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO assets (asset_id, label, asset_type, theme_name, cv_data, is_default, created_at, updated_at)
     VALUES (?, ?, 'cv_page', ?, ?, 1, ?, ?)`
  ).bind(assetId, 'Default CV', themeName, cvRaw, now, now).run();

  return {
    asset_id: assetId,
    label: 'Default CV',
    asset_type: 'cv_page',
    theme_name: themeName,
    cv_data: cvRaw,
    is_default: 1,
    created_at: now,
    updated_at: now,
  };
}
