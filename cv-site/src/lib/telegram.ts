import type { TelegramConfig } from '../types/index.ts';

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(config: TelegramConfig, text: string): Promise<void> {
  if (!config.enabled) return;

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Telegram API error: ${response.status} ${error}`);
  }
}

/**
 * Get telegram config from KV
 */
export async function getTelegramConfig(kv: KVNamespace): Promise<TelegramConfig | null> {
  const raw = await kv.get('config:telegram');
  if (!raw) return null;
  return JSON.parse(raw) as TelegramConfig;
}

// ============================================
// Notification helpers
// ============================================

export async function notifyNewVisitor(
  kv: KVNamespace,
  info: { ip?: string; country?: string; city?: string }
): Promise<void> {
  const config = await getTelegramConfig(kv);
  if (!config) return;

  const location = [info.city, info.country].filter(Boolean).join(', ') || 'Unknown';
  const text = `👤 <b>New CV Visitor</b>\nIP: <code>${info.ip ?? 'Unknown'}</code>\nLocation: ${location}`;
  await sendTelegramMessage(config, text);
}

export async function notifyFileRequest(
  kv: KVNamespace,
  info: { email: string; files: string[] }
): Promise<void> {
  const config = await getTelegramConfig(kv);
  if (!config) return;

  const text = `📄 <b>File Request</b>\nTo: <code>${info.email}</code>\nFiles: ${info.files.join(', ')}`;
  await sendTelegramMessage(config, text);
}

export async function notifyNewMessage(
  kv: KVNamespace,
  info: { name?: string; email?: string; content: string }
): Promise<void> {
  const config = await getTelegramConfig(kv);
  if (!config) return;

  const from = info.name || info.email || 'Anonymous';
  const preview = info.content.length > 200 ? info.content.slice(0, 200) + '...' : info.content;
  const text = `💬 <b>New Message</b>\nFrom: ${from}\n${info.email ? `Email: <code>${info.email}</code>\n` : ''}Message: ${preview}`;
  await sendTelegramMessage(config, text);
}
