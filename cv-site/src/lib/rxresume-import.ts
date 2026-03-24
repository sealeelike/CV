import type { CVData } from '../types/index.ts';

/** Strip HTML tags and decode basic entities, returning plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<\/?(ul|ol|li|p|div|br|h[1-6])[^>]*>/gi, (tag) => {
      // Insert newline before closing list items so they split correctly
      return /^<\/li>/i.test(tag) ? '\n' : '';
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

/** Convert HTML description to array of highlight strings. */
function descriptionToHighlights(html: string): string[] {
  if (!html) return [];
  return stripHtml(html)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse a free-text period string into startDate / endDate.
 * Examples:
 *   "June to August 2025"       → { startDate: "June 2025", endDate: "August 2025" }
 *   "April 2025-Submission"     → { startDate: "April 2025", endDate: "Submission" }
 *   "2023-01"                   → { startDate: "2023-01" }
 */
function parsePeriod(period: string): { startDate: string; endDate?: string } {
  if (!period) return { startDate: '' };

  const toMatch = period.match(/^(.+?)\s+to\s+(.+)$/i);
  if (toMatch) {
    return { startDate: toMatch[1].trim(), endDate: toMatch[2].trim() };
  }

  // Split on " - " or " – " (with spaces) to avoid splitting ISO dates like "2023-01"
  const dashMatch = period.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dashMatch) {
    return { startDate: dashMatch[1].trim(), endDate: dashMatch[2].trim() };
  }

  return { startDate: period.trim() };
}

// ----------------------------------------------------------------
// Main converter
// ----------------------------------------------------------------

export function importFromRxresume(raw: Record<string, any>): CVData {
  const basics = raw.basics ?? {};
  const picture = raw.picture ?? {};
  const summary = raw.summary ?? {};
  const sections = raw.sections ?? {};

  // --- Header links ---
  const links: CVData['header']['links'] = [];

  if (basics.email) {
    links.push({ label: basics.email, url: `mailto:${basics.email}` });
  }
  if (basics.phone) {
    links.push({ label: basics.phone, url: `tel:${basics.phone.replace(/\s/g, '')}` });
  }
  if (basics.location) {
    links.push({ label: basics.location, url: '' });
  }
  if (basics.website?.url) {
    links.push({ label: basics.website.label || basics.website.url, url: basics.website.url });
  }

  for (const profile of (sections.profiles?.items ?? [])) {
    if (profile.hidden) continue;
    links.push({
      label: profile.username ? `${profile.network}: ${profile.username}` : profile.network,
      url: profile.website?.url ?? '',
      icon: profile.icon,
    });
  }

  // --- Summary (strip HTML) ---
  const summaryText = summary.content ? stripHtml(summary.content) : '';

  // --- Experience ---
  const experience: CVData['experience'] = [];
  for (const item of (sections.experience?.items ?? [])) {
    if (item.hidden) continue;
    const { startDate, endDate } = parsePeriod(item.period ?? '');
    experience.push({
      company: item.company ?? '',
      role: item.position ?? '',
      location: item.location || undefined,
      startDate,
      endDate,
      highlights: descriptionToHighlights(item.description ?? ''),
    });
  }

  // --- Education ---
  const education: CVData['education'] = [];
  for (const item of (sections.education?.items ?? [])) {
    if (item.hidden) continue;
    const { startDate, endDate } = parsePeriod(item.period ?? item.date ?? '');
    education.push({
      institution: item.institution ?? item.school ?? '',
      degree: item.degree ?? item.studyType ?? '',
      field: (item.field ?? item.area) || undefined,
      startDate,
      endDate,
      highlights: descriptionToHighlights(item.description ?? ''),
    });
  }

  // --- Skills (group all into one category) ---
  const skillItems: string[] = [];
  for (const item of (sections.skills?.items ?? [])) {
    if (item.hidden) continue;
    skillItems.push(item.name);
  }
  const skills: CVData['skills'] = skillItems.length > 0
    ? [{ category: 'Skills', items: skillItems }]
    : [];

  // --- Projects ---
  const projects: CVData['projects'] = [];
  for (const item of (sections.projects?.items ?? [])) {
    if (item.hidden) continue;
    projects.push({
      name: item.name ?? '',
      description: stripHtml(item.description ?? ''),
      url: item.website?.url || undefined,
      highlights: [],
    });
  }

  // --- Awards ---
  const awards: CVData['awards'] = [];
  for (const item of (sections.awards?.items ?? [])) {
    if (item.hidden) continue;
    awards.push({
      title: item.title ?? '',
      awarder: item.awarder ?? '',
      date: item.date || undefined,
      description: item.description ? stripHtml(item.description) : undefined,
    });
  }

  // --- Avatar ---
  const avatar = (!picture.hidden && picture.url) ? picture.url : undefined;

  return {
    meta: {
      title: `${basics.name ?? 'CV'} - CV`,
      lang: raw.metadata?.page?.locale?.split('-')[0] ?? 'en',
    },
    header: {
      name: basics.name ?? '',
      title: basics.headline ?? '',
      summary: summaryText,
      avatar,
      links,
    },
    experience,
    education,
    skills,
    projects,
    awards: awards.length > 0 ? awards : undefined,
  };
}
