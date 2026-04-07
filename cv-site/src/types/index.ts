// ============================================
// Cloudflare Bindings
// ============================================
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
}

// ============================================
// Database Models
// ============================================
export interface Guest {
  guest_id: number;
  ip: string | null;
  fingerprint: string | null;
  fingerprint_raw: string | null; // JSON: {ua, lang, screen, colorDepth, timezone, cpu, platform}
  user_agent: string | null;
  geo_country: string | null;
  geo_city: string | null;
  magic_link_id: string | null;
  consent_time: string;
}

export interface GuestWithMagicLink extends Guest {
  magic_link_token: string | null;
  magic_link_label: string | null;
}

export interface LinkAccess {
  access_id: number;
  magic_link_id: string;
  ip: string | null;
  user_agent: string | null;
  geo_country: string | null;
  geo_city: string | null;
  accessed_at: string;
}

export interface LinkAccessWithMagicLink extends LinkAccess {
  magic_link_token: string | null;
  magic_link_label: string | null;
}

export interface FileRequest {
  request_id: number;
  tracking_code: string | null;
  guest_id: number | null;
  recipient_email: string;
  file_list: string; // JSON array
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
}

export interface Message {
  message_id: number;
  guest_id: number | null;
  name: string | null;
  email: string | null;
  content: string;
  read: number; // 0 or 1
  created_at: string;
}

export interface VariantAsset {
  asset_id: string;
  label: string; // e.g. "EN", "中文", "日本語"
  is_default?: boolean;
}

export interface MagicLink {
  link_id: string;
  token: string;
  label: string | null;
  asset_id: string | null;
  allowed_files: string | null; // JSON array of file keys
  expires_at: string | null;
  max_uses: number | null;
  require_email: number; // 1=enforce whitelist, 0=skip
  variant_assets: string | null; // JSON string of VariantAsset[]
  use_count: number;
  created_at: string;
}

export interface Asset {
  asset_id: string;
  label: string;
  asset_type: 'cv_page';
  theme_name: string;
  cv_data: string; // JSON string of CVData
  is_default: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

// ============================================
// CV Data Structure
// ============================================
export interface CVData {
  meta: {
    title: string;
    lang: string;
  };
  header: {
    name: string;
    title: string;
    summary: string;
    avatar?: string;
    links: { label: string; url: string; icon?: string }[];
  };
  experience: {
    company: string;
    role: string;
    location?: string;
    startDate: string;
    endDate?: string;
    highlights: string[];
    showRequestLink?: boolean;
  }[];
  education: {
    institution: string;
    degree: string;
    field?: string;
    startDate: string;
    endDate?: string;
    highlights?: string[];
    showRequestLink?: boolean;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
  projects?: {
    name: string;
    description: string;
    url?: string;
    highlights?: string[];
    showRequestLink?: boolean;
  }[];
  awards?: {
    title: string;
    awarder: string;
    date?: string;
    description?: string;
    showRequestLink?: boolean;
  }[];
  custom?: {
    id: string;
    title: string;
    content: string; // HTML or markdown
  }[];
  footerLinks?: { label: string; url: string }[];
}

// ============================================
// Theme
// ============================================

// Declares which CV sections a theme supports (Phase 1: section-level only)
export interface ThemeFieldDef {
  section: 'experience' | 'education' | 'skills' | 'projects' | 'awards' | 'custom';
  required?: boolean;
}

export interface ThemeStrings {
  navLinks?: Array<{ label: string; href: string; active?: boolean }>;
  navDownload?: string;
  footerCopy?: string;
  contactTitle?: string;
  sectionExperience?: string;
  sectionEducation?: string;
  sectionSkills?: string;
  sectionProjects?: string;
  sectionAwards?: string;
  requestDocument?: string;
}

export interface ThemeLanguage {
  label: string;           // "English", "中文"
  fonts?: string[];        // language-specific Google Fonts URLs
  strings?: ThemeStrings;  // language-specific UI strings
}

export interface ThemeConfig {
  name: string;
  author: string;
  version: string;
  variables: Record<string, string>;
  layout: {
    sections: string[];
    sidebar: boolean;
    sidebarSections?: string[];
    headerStyle: 'centered' | 'left' | 'split';
    fields?: ThemeFieldDef[]; // sections this theme supports
  };
  fonts?: string[];           // fallback fonts
  strings?: ThemeStrings;     // fallback strings
  languages?: Record<string, ThemeLanguage>;  // language variants
}

// ============================================
// KV Config Types
// ============================================
export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface EmailConfig {
  resendApiKey: string;
  fromAddress: string;
  fromName: string;
  whitelist: string[]; // allowed recipient email domains/addresses
  deliverySubject?: string; // template: {{trackingCode}}, {{files}}, {{domain}}
  deliveryBody?: string;    // HTML template with same placeholders
}

export interface TurnstileConfig {
  siteKey: string;
  secretKey: string;
  enabled: boolean;
}

export interface AccessConfig {
  mode: 'open' | 'invite_only' | 'magic_link'; // magic_link is legacy alias for invite_only
}

export interface AdminConfig {
  passwordHash: string;
}

// ============================================
// API Request/Response Types
// ============================================
export interface ConsentPayload {
  fingerprint: string;
  fingerprintRaw?: {
    ua: string;
    lang: string;
    screen: string;
    colorDepth: number;
    timezone: number;
    cpu: number;
    platform: string;
  };
  turnstileToken?: string;
  magicLinkId?: string;
}

export interface FileRequestPayload {
  recipientEmail: string;
  fileList: string[];
  turnstileToken?: string;
}

export interface ContactPayload {
  name?: string;
  email?: string;
  content: string;
  turnstileToken?: string;
}

export interface AdminLoginPayload {
  password: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
