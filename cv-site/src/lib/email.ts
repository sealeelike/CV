import type { EmailConfig } from '../types/index.ts';

interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: {
    filename: string;
    content: string; // base64 encoded
    content_type?: string;
  }[];
}

/**
 * Send email via Resend API
 */
export async function sendEmail(config: EmailConfig, params: SendEmailParams): Promise<{ id: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromAddress}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} ${error}`);
  }

  return response.json() as Promise<{ id: string }>;
}

/**
 * Get email config from KV
 */
export async function getEmailConfig(kv: KVNamespace): Promise<EmailConfig | null> {
  const raw = await kv.get('config:email');
  if (!raw) return null;
  return JSON.parse(raw) as EmailConfig;
}

/**
 * Check if a recipient email is in the whitelist
 */
export function isEmailWhitelisted(email: string, whitelist: string[]): boolean {
  const emailLower = email.toLowerCase();
  return whitelist.some((entry) => {
    const entryLower = entry.toLowerCase();
    // Exact match
    if (emailLower === entryLower) return true;
    // Domain match (e.g. "@google.com")
    if (entryLower.startsWith('@') && emailLower.endsWith(entryLower)) return true;
    return false;
  });
}
