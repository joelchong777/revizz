const intFmt = new Intl.NumberFormat('en-SG');
const dec1 = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 1 });

export const fmtInt = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : intFmt.format(n);

export const fmtNum = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : dec1.format(n);

/** Fraction 0-1 to a percentage with 0-1 decimals. */
export const fmtPct = (f: number | null | undefined): string =>
  f == null || !Number.isFinite(f)
    ? '—'
    : `${new Intl.NumberFormat('en-SG', { maximumFractionDigits: 1 }).format(f * 100)}%`;

export const fmtSecs = (s: number | null | undefined): string => {
  if (s == null || !Number.isFinite(s)) return '—';
  if (s >= 60) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${dec1.format(s)}s`;
};

export const fmtDay = (day: string): string => {
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? day
    : d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
};

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
