/**
 * Canonical URL resolution utility for question diagrams.
 * Maps local relative paths (e.g. /questions/0455_2024_w_13_q18.png)
 * to public Supabase Storage CDN URLs.
 */
export function resolveDiagramUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') {
    return undefined;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }

  // If already absolute URL or data URI, return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Extract clean basename if relative path like "/questions/foo.png", "questions/foo.png", or "foo.png"
  const cleanBasename = trimmed.split('/').pop()?.split('?')[0];
  if (!cleanBasename) {
    return undefined;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const normalizedBase = supabaseUrl.replace(/\/+$/, '');

  return `${normalizedBase}/storage/v1/object/public/question-diagrams/${cleanBasename}`;
}
