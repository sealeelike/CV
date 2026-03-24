import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { insertMagicLink, getMagicLinks, updateMagicLink, deleteMagicLink } from '../../../lib/db.ts';
import { generateToken } from '../../../lib/magic-link.ts';

// List all magic links
export const GET: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  const isAuthed = await requireAdmin(request, kv);
  if (!isAuthed) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const links = await getMagicLinks(db);
  return Response.json({ ok: true, data: links } satisfies ApiResponse);
};

// Create a new magic link
export const POST: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  const isAuthed = await requireAdmin(request, kv);
  if (!isAuthed) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = await request.json() as {
    customToken?: string;
    label?: string;
    assetId?: string;
    allowedFiles?: string[];
    expiresAt?: string;
    maxUses?: number;
    requireEmail?: boolean;
    variantAssets?: { asset_id: string; label: string }[];
  };

  // Use custom token (empty string = public access link) or generate random one
  const token = body.customToken !== undefined ? body.customToken.trim() : generateToken();

  // Validate non-empty custom tokens (alphanumeric + hyphens, 4-128 chars)
  if (body.customToken !== undefined && body.customToken.trim() !== '') {
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(token)) {
      return Response.json(
        { ok: false, error: 'Custom token must be 4-128 characters (letters, numbers, hyphens, underscores)' } satisfies ApiResponse,
        { status: 400 }
      );
    }
  }

  const linkId = crypto.randomUUID();

  try {
    const link = await insertMagicLink(db, {
      linkId,
      token,
      label: body.label || undefined,
      assetId: body.assetId || undefined,
      allowedFiles: Array.isArray(body.allowedFiles) ? body.allowedFiles : undefined,
      expiresAt: body.expiresAt || undefined,
      maxUses: body.maxUses ?? undefined,
      requireEmail: body.requireEmail,
      variantAssets: body.variantAssets?.length ? body.variantAssets : undefined,
    });
    return Response.json({ ok: true, data: link } satisfies ApiResponse, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return Response.json(
        { ok: false, error: 'This token already exists. Choose a different one.' } satisfies ApiResponse,
        { status: 409 }
      );
    }
    throw err;
  }
};

// Update a magic link
export const PATCH: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  const isAuthed = await requireAdmin(request, kv);
  if (!isAuthed) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const linkId = url.searchParams.get('id');
  if (!linkId) {
    return Response.json({ ok: false, error: 'Missing link ID' } satisfies ApiResponse, { status: 400 });
  }

  const body = await request.json() as {
    label?: string | null;
    assetId?: string | null;
    allowedFiles?: string[] | null;
    expiresAt?: string | null;
    maxUses?: number | null;
    requireEmail?: boolean | null;
    variantAssets?: { asset_id: string; label: string }[] | null;
  };

  const updated = await updateMagicLink(db, linkId, {
    ...('label' in body && { label: body.label }),
    ...('assetId' in body && { assetId: body.assetId }),
    ...('allowedFiles' in body && { allowedFiles: body.allowedFiles }),
    ...('expiresAt' in body && { expiresAt: body.expiresAt }),
    ...('maxUses' in body && { maxUses: body.maxUses }),
    ...('requireEmail' in body && { requireEmail: body.requireEmail }),
    ...('variantAssets' in body && { variantAssets: body.variantAssets }),
  });

  if (!updated) {
    return Response.json({ ok: false, error: 'Link not found or nothing to update' } satisfies ApiResponse, { status: 404 });
  }

  return Response.json({ ok: true, data: updated } satisfies ApiResponse);
};

// Delete a magic link
export const DELETE: APIRoute = async ({ request }) => {
  const kv = env.KV as KVNamespace;
  const db = env.DB as D1Database;

  const isAuthed = await requireAdmin(request, kv);
  if (!isAuthed) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const linkId = url.searchParams.get('id');
  if (!linkId) {
    return Response.json({ ok: false, error: 'Missing link ID' } satisfies ApiResponse, { status: 400 });
  }

  await deleteMagicLink(db, linkId);
  return Response.json({ ok: true } satisfies ApiResponse);
};
