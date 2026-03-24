import type { CVData, ThemeConfig, AccessConfig } from '../types/index.ts';

/**
 * Get CV content data from KV
 */
export async function getCVData(kv: KVNamespace): Promise<CVData | null> {
  const raw = await kv.get('cv:content');
  if (!raw) return null;
  return JSON.parse(raw) as CVData;
}

/**
 * Save CV content data to KV
 */
export async function setCVData(kv: KVNamespace, data: CVData): Promise<void> {
  await kv.put('cv:content', JSON.stringify(data));
}

/**
 * Get current active theme name
 */
export async function getActiveTheme(kv: KVNamespace): Promise<string> {
  return (await kv.get('cv:theme')) ?? 'default';
}

/**
 * Set active theme name
 */
export async function setActiveTheme(kv: KVNamespace, themeName: string): Promise<void> {
  await kv.put('cv:theme', themeName);
}

/**
 * Get access control config
 */
export async function getAccessConfig(kv: KVNamespace): Promise<AccessConfig> {
  const raw = await kv.get('config:access');
  if (!raw) return { mode: 'open' };
  return JSON.parse(raw) as AccessConfig;
}

/**
 * Set access control config
 */
export async function setAccessConfig(kv: KVNamespace, config: AccessConfig): Promise<void> {
  await kv.put('config:access', JSON.stringify(config));
}

/**
 * Generic config getter
 */
export async function getConfig<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

/**
 * Generic config setter
 */
export async function setConfig(kv: KVNamespace, key: string, value: unknown): Promise<void> {
  await kv.put(key, JSON.stringify(value));
}
