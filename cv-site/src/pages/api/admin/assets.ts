import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse, Asset } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';

export const GET: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const { results } = await db.prepare(
    'SELECT * FROM assets ORDER BY is_default DESC, updated_at DESC'
  ).all<Asset>();

  return Response.json({ ok: true, data: { assets: results } } satisfies ApiResponse);
};

export const POST: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = await request.json() as {
    label?: string;
    theme_name?: string;
    cv_data?: string;
    is_default?: boolean;
  };

  if (!body.label || !body.theme_name || !body.cv_data) {
    return Response.json({ ok: false, error: 'label, theme_name, and cv_data are required' } satisfies ApiResponse, { status: 400 });
  }

  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();

  // If marking as default, clear other defaults first
  if (body.is_default) {
    await db.prepare('UPDATE assets SET is_default = 0 WHERE is_default = 1').run();
  }

  await db.prepare(
    `INSERT INTO assets (asset_id, label, asset_type, theme_name, cv_data, is_default, created_at, updated_at)
     VALUES (?, ?, 'cv_page', ?, ?, ?, ?, ?)`
  ).bind(assetId, body.label, body.theme_name, body.cv_data, body.is_default ? 1 : 0, now, now).run();

  return Response.json({ ok: true, data: { asset_id: assetId } } satisfies ApiResponse, { status: 201 });
};

export const PATCH: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = await request.json() as {
    asset_id?: string;
    label?: string;
    theme_name?: string;
    cv_data?: string;
    is_default?: boolean;
  };

  if (!body.asset_id) {
    return Response.json({ ok: false, error: 'asset_id is required' } satisfies ApiResponse, { status: 400 });
  }

  // Check asset exists
  const existing = await db.prepare('SELECT asset_id FROM assets WHERE asset_id = ?').bind(body.asset_id).first();
  if (!existing) {
    return Response.json({ ok: false, error: 'Asset not found' } satisfies ApiResponse, { status: 404 });
  }

  // Build dynamic update
  const sets: string[] = [];
  const values: (string | number)[] = [];

  if (body.label !== undefined) { sets.push('label = ?'); values.push(body.label); }
  if (body.theme_name !== undefined) { sets.push('theme_name = ?'); values.push(body.theme_name); }
  if (body.cv_data !== undefined) { sets.push('cv_data = ?'); values.push(body.cv_data); }
  if (body.is_default !== undefined) {
    if (body.is_default) {
      await db.prepare('UPDATE assets SET is_default = 0 WHERE is_default = 1').run();
    }
    sets.push('is_default = ?');
    values.push(body.is_default ? 1 : 0);
  }

  if (sets.length === 0) {
    return Response.json({ ok: false, error: 'No fields to update' } satisfies ApiResponse, { status: 400 });
  }

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(body.asset_id);

  await db.prepare(`UPDATE assets SET ${sets.join(', ')} WHERE asset_id = ?`).bind(...values).run();

  return Response.json({ ok: true } satisfies ApiResponse);
};

export const DELETE: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const assetId = url.searchParams.get('id');

  if (!assetId) {
    return Response.json({ ok: false, error: 'id query param is required' } satisfies ApiResponse, { status: 400 });
  }

  // Cannot delete default asset
  const asset = await db.prepare('SELECT is_default FROM assets WHERE asset_id = ?').bind(assetId).first<{ is_default: number }>();
  if (!asset) {
    return Response.json({ ok: false, error: 'Asset not found' } satisfies ApiResponse, { status: 404 });
  }
  if (asset.is_default === 1) {
    return Response.json({ ok: false, error: 'Cannot delete the default asset' } satisfies ApiResponse, { status: 400 });
  }

  // Clear references in magic_links
  await db.prepare('UPDATE magic_links SET asset_id = NULL WHERE asset_id = ?').bind(assetId).run();
  await db.prepare('DELETE FROM assets WHERE asset_id = ?').bind(assetId).run();

  return Response.json({ ok: true } satisfies ApiResponse);
};
