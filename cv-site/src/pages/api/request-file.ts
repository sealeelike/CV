import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { FileRequestPayload, ApiResponse, EmailConfig } from '../../types/index.ts';
import { insertFileRequest, updateFileRequestStatus, getMagicLinkById } from '../../lib/db.ts';
import { checkTurnstile } from '../../lib/turnstile.ts';
import { getEmailConfig, isEmailWhitelisted, sendEmail } from '../../lib/email.ts';
import { notifyFileRequest } from '../../lib/telegram.ts';
import { addWatermark } from '../../lib/watermark.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = env.DB as D1Database;
  const kv = env.KV as KVNamespace;
  const r2 = env.R2 as R2Bucket;

  try {
    const body = (await request.json()) as FileRequestPayload;

    // Validate input
    if (!body.recipientEmail || !body.fileList?.length) {
      return Response.json({ ok: false, error: 'Recipient email and file list are required' } satisfies ApiResponse, { status: 400 });
    }

    // Verify turnstile
    const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
    const turnstileOk = await checkTurnstile(kv, body.turnstileToken, ip);
    if (!turnstileOk) {
      return Response.json({ ok: false, error: 'Human verification failed' } satisfies ApiResponse, { status: 403 });
    }

    // Check email whitelist
    const emailConfig = await getEmailConfig(kv);
    if (!emailConfig) {
      return Response.json({ ok: false, error: 'Email service is not configured' } satisfies ApiResponse, { status: 503 });
    }

    // Check if the active magic link bypasses email whitelist
    let skipWhitelist = false;
    const cookieHeader = request.headers.get('Cookie') ?? '';
    const magicMatch = cookieHeader.match(/(?:^|;\s*)magic_link=([^;]+)/);
    if (magicMatch) {
      const link = await getMagicLinkById(db, magicMatch[1]);
      if (link && !link.require_email) skipWhitelist = true;
    }

    // Only enforce whitelist if it has entries AND the magic link requires it
    if (!skipWhitelist && emailConfig.whitelist?.length > 0 && !isEmailWhitelisted(body.recipientEmail, emailConfig.whitelist)) {
      return Response.json({ ok: false, error: 'Recipient email is not authorized' } satisfies ApiResponse, { status: 403 });
    }

    // Create request record
    const guestId = request.headers.get('X-Guest-Id');
    const fileRequest = await insertFileRequest(db, {
      guestId: guestId ? parseInt(guestId, 10) : undefined,
      recipientEmail: body.recipientEmail,
      fileList: body.fileList,
    });

    // Process and send files
    try {
      const attachments: { filename: string; content: string; content_type: string }[] = [];

      for (const fileKey of body.fileList) {
        const object = await r2.get(`files/${fileKey}`);
        if (!object) {
          console.warn(`File not found in R2: files/${fileKey}`);
          continue;
        }

        const originalBytes = await object.arrayBuffer();

        // Add watermark if it's a PDF
        let finalBytes: ArrayBuffer | Uint8Array;
        if (fileKey.toLowerCase().endsWith('.pdf')) {
          finalBytes = await addWatermark(originalBytes, fileRequest.tracking_code!);
        } else {
          finalBytes = originalBytes;
        }

        // Convert to base64 for Resend attachment
        const base64 = btoa(
          Array.from(new Uint8Array(finalBytes))
            .map((b) => String.fromCharCode(b))
            .join('')
        );

        attachments.push({
          filename: fileKey,
          content: base64,
          content_type: object.httpMetadata?.contentType ?? 'application/octet-stream',
        });
      }

      if (attachments.length === 0) {
        await updateFileRequestStatus(db, fileRequest.request_id, 'failed');
        return Response.json({ ok: false, error: 'No files could be found' } satisfies ApiResponse, { status: 404 });
      }

      // Build email from template (with fallback defaults)
      const trackingCode = fileRequest.tracking_code!;
      const fileNames = body.fileList.join(', ');
      const domain = new URL(request.url).hostname;

      const defaultSubject = `Document Request — ${trackingCode}`;
      const defaultBody = `<p>Hello,</p>
<p>Someone has requested the following document(s) from <strong>${domain}</strong>:</p>
<ul>${body.fileList.map((f: string) => `<li>${f}</li>`).join('')}</ul>
<p>They are attached to this email for your reference.</p>
<p style="margin-top:1em;font-size:0.9em;color:#666;">Tracking reference: <strong>${trackingCode}</strong><br/>
If you did not expect this email, you may safely ignore it.</p>
<p>Best regards</p>`;

      const renderTemplate = (tpl: string) =>
        tpl
          .replace(/\{\{trackingCode\}\}/g, trackingCode)
          .replace(/\{\{files\}\}/g, fileNames)
          .replace(/\{\{domain\}\}/g, domain);

      const subject = emailConfig.deliverySubject
        ? renderTemplate(emailConfig.deliverySubject)
        : defaultSubject;
      const html = emailConfig.deliveryBody
        ? renderTemplate(emailConfig.deliveryBody)
        : defaultBody;

      // Send email
      await sendEmail(emailConfig, {
        to: body.recipientEmail,
        subject,
        html,
        attachments,
      });

      await updateFileRequestStatus(db, fileRequest.request_id, 'sent');

      // Notify admin
      notifyFileRequest(kv, {
        email: body.recipientEmail,
        files: body.fileList,
      }).catch(console.error);

      return Response.json({ ok: true, data: { requestId: fileRequest.request_id } } satisfies ApiResponse, { status: 200 });
    } catch (sendErr) {
      console.error('Send error:', sendErr);
      await updateFileRequestStatus(db, fileRequest.request_id, 'failed');
      return Response.json({ ok: false, error: 'Failed to send files' } satisfies ApiResponse, { status: 500 });
    }
  } catch (err) {
    console.error('Request file error:', err);
    return Response.json({ ok: false, error: 'Internal error' } satisfies ApiResponse, { status: 500 });
  }
};
