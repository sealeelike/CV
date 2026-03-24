# CV Site

A self-hosted CV hosting platform that makes your resume feel like a polished product page — not a PDF attachment. Runs on Cloudflare, deploy under your own domain.

> [!IMPORTANT]
> I'm personally strongly against flooding codebases with AI-generated content the author doesn't fully understand — what the community calls "AI slop." That said, I needed this project quickly and built it with heavy AI assistance. I'm being upfront about that.
>
> As a result, my current skill level isn't sufficient to properly review overly complex PRs — they may not get merged. But any **issue**, **bug report**, or ⭐ **star** is genuinely appreciated and will be seen. Thank you for understanding.
>
> **This project is actively being developed and debugged — not yet in a stable state. Deploy at your own risk.**

---

## 🤔 Why not just a PDF?

A static PDF is one-size-fits-all and leaves you blind. CV Site gives you:

- 🌐 **A real URL that looks professional** — `cv.yourdomain.com`, served from Cloudflare's global edge
- ✨ **Animations and rich layouts** — themes can use any CSS/JS effect, potentially leaving a stronger impression than a flat document
- 👁️ **Full visibility** — you know exactly who opened your CV, when, and from where
- 🎯 **Control over what each person sees** — show different CV versions or languages to different recruiters via magic links

## ⚙️ How it works

```
Theme + Data → Asset → Magic Link → Visitor
```

You create an Asset (theme + your CV data), generate a Magic Link, share it. Change your CV anytime — the link always shows the latest version, no resend needed.

## ✨ Key features

- 🔗 **Magic Links** — per-visitor access with custom CV content, file permissions, optional email whitelist
- 🎨 **Themes** — built-in editorial themes with rich typography and layout; custom theme support in development
- 🌍 **Multi-language** — one theme, multiple language variants (en/zh built-in); language switcher in CV header
- 📎 **Proof file requests** — visitor submits a request; you get a Telegram alert; Resend delivers the file from your own domain. Whitelist controls who can request
- 📊 **Visitor analytics** — browser fingerprint aggregation (UA, screen, timezone, CPU, platform), visit history, per-visitor detail, clickable filter
- 💬 **Contact messages** — visitors can leave messages, stored in admin
- 📥 **RxResume import** — import rxresu.me JSON directly into the asset editor
- 🔔 **Alerts** — Telegram push (new visitors, file requests) + Resend transactional email

## 🛠️ Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (SSR) |
| Framework | Astro + TypeScript |
| Database | D1 (SQLite) |
| Files | R2 Object Storage |
| Config | KV Namespace |
| CAPTCHA | Turnstile (optional) |

## 🚀 Deploy in 5 minutes

See [Deployment Guide](wiki/Deployment-Guide.md) — requires a Cloudflare account (free tier).

The short version:

```bash
git clone https://github.com/sealeelike/CV.git
cd CV/cv-site && npm install
npx wrangler login
# create D1 / R2 / KV resources, update wrangler.jsonc
npx wrangler d1 execute cv-site-db --remote --file=schema.sql
npm run build && npx wrangler deploy
```

First login to `/admin/login` sets your password.

## 🗂️ Admin panel

- `/admin/assets` — manage CV assets (theme + data pairs), inline JSON editor, proof files
- `/admin/themes` — Theme Store: browse built-in themes, create assets, upload custom themes
- `/admin/access` — Magic Links: create links, assign assets, set file permissions, language variants
- `/admin/visitors` — visitor list with fingerprint details
- `/admin/requests` — proof file request log
- `/admin/settings` — Resend, Telegram, Turnstile config

## 🗺️ Roadmap

Features planned or in progress:

- 🎨 **Custom theme upload** — package your own theme (CSS + config) and use it as a template
- 🖼️ **Avatar upload** — upload a profile photo directly in the asset editor
- 🔏 **PDF watermarks** — per-link custom watermark text (e.g. "For Google HR only")
- 🌐 **Multi-language email** — deliver proof file emails in the visitor's language
- 📧 **Email template presets** — pre-filled Resend email body with placeholders
- 🗑️ **Record management** — delete visitors, requests, and messages; batch delete
- 📝 **Visitor notes** — add private notes to guest records in the admin panel
- 🐳 **Platform portability** — support for more deployment targets beyond Cloudflare (Docker, Vercel, and others)
