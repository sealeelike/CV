import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ApiResponse, ThemeConfig } from '../../../types/index.ts';
import { requireAdmin } from '../../../lib/auth.ts';
import { getActiveTheme, setActiveTheme } from '../../../lib/kv.ts';
import { loadTheme } from '../../../lib/theme.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;
  const r2 = env.R2 as R2Bucket;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const url = new URL(request.url);
  const nameParam = url.searchParams.get('name');

  // If ?name=xxx, return that specific theme's config
  if (nameParam) {
    const theme = await loadTheme(nameParam, r2);
    return Response.json({
      ok: true,
      data: { config: theme.config },
    } satisfies ApiResponse);
  }

  const activeTheme = await getActiveTheme(kv);

  // List custom themes from R2
  const list = await r2.list({ prefix: 'themes/' });
  const customThemes: string[] = [];
  const seen = new Set<string>();
  for (const obj of list.objects) {
    // themes/mytheme/theme.json → mytheme
    const parts = obj.key.split('/');
    if (parts.length >= 2 && !seen.has(parts[1])) {
      seen.add(parts[1]);
      customThemes.push(parts[1]);
    }
  }

  // Load configs for all themes
  const allNames = ['default', 'minimal', ...customThemes];
  const configs: Record<string, ThemeConfig> = {};
  for (const name of allNames) {
    const theme = await loadTheme(name, r2);
    configs[name] = theme.config;
  }

  return Response.json({
    ok: true,
    data: {
      activeTheme,
      builtinThemes: ['default', 'minimal'],
      customThemes,
      configs,
    },
  } satisfies ApiResponse);
};

export const PUT: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const body = (await request.json()) as { theme: string };
  if (!body.theme) {
    return Response.json({ ok: false, error: 'Theme name is required' } satisfies ApiResponse, { status: 400 });
  }

  await setActiveTheme(kv, body.theme);

  return Response.json({ ok: true } satisfies ApiResponse);
};

// Upload a custom theme (zip or individual files)
export const POST: APIRoute = async ({ request, locals }) => {
  const kv = env.KV as KVNamespace;
  const r2 = env.R2 as R2Bucket;

  if (!(await requireAdmin(request, kv))) {
    return Response.json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse, { status: 401 });
  }

  const formData = await request.formData();
  const themeName = formData.get('name') as string;
  const themeJson = formData.get('theme.json') as File | null;
  const styleCss = formData.get('style.css') as File | null;

  if (!themeName) {
    return Response.json({ ok: false, error: 'Theme name is required' } satisfies ApiResponse, { status: 400 });
  }

  if (themeJson) {
    const content = await themeJson.text();
    await r2.put(`themes/${themeName}/theme.json`, content, {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  if (styleCss) {
    const content = await styleCss.text();
    await r2.put(`themes/${themeName}/style.css`, content, {
      httpMetadata: { contentType: 'text/css' },
    });
  }

  return Response.json({ ok: true, data: { theme: themeName } } satisfies ApiResponse);
};
