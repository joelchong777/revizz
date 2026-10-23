// Bulk user upload: pure helpers shared by the client (preview) and the server (re-validation).
export const BULK_TEMPLATE_HEADERS = ['email', 'full_name', 'role', 'cohort'] as const;
export const BULK_TEMPLATE_PATH = '/templates/revizz-bulk-users-template.csv';
export const BULK_MAX_ROWS = 500;
export const BULK_CHUNK_SIZE = 25;
export const BULK_ROLES = ['student', 'teacher'] as const;
export type BulkRole = (typeof BULK_ROLES)[number];

export interface BulkUserRow {
  line: number;
  email: string;
  fullName: string;
  role: BulkRole;
  cohort: string;
}
export interface BulkRowError {
  line: number;
  email?: string;
  message: string;
}
export interface BulkInviteResult {
  line: number;
  email: string;
  status: 'invited' | 'skipped' | 'failed';
  reason?: string;
  emailSent: boolean;
  inviteLink?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parses CSV keeping blank records so callers can compute spreadsheet row numbers. */
function parseRecords(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? '';
  const delim = !firstLine.includes(',') && firstLine.includes(';') ? ';' : ',';

  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const endRecord = () => {
    row.push(field);
    records.push(row);
    row = [];
    field = '';
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRecord();
    } else if (ch === '\n') {
      endRecord();
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== '' || row.length > 0) endRecord();
  return records;
}

const isBlank = (r: string[]) => r.every((c) => c.trim() === '');

export function parseCsv(text: string): string[][] {
  return parseRecords(text).filter((r) => !isBlank(r));
}

const HEADER_ALIASES: Record<string, string> = {
  email: 'email',
  'email address': 'email',
  full_name: 'full_name',
  name: 'full_name',
  'full name': 'full_name',
  role: 'role',
  cohort: 'cohort',
};

export function validateBulkRows(text: string): { rows: BulkUserRow[]; errors: BulkRowError[] } {
  const rows: BulkUserRow[] = [];
  const errors: BulkRowError[] = [];
  const records = parseRecords(text);
  const headerIdx = records.findIndex((r) => !isBlank(r));
  if (headerIdx === -1) {
    return { rows, errors: [{ line: 1, message: 'The file is empty. Use the template to get started.' }] };
  }
  const cols: Record<string, number> = {};
  records[headerIdx].forEach((h, idx) => {
    const key = HEADER_ALIASES[h.trim().toLowerCase()];
    if (key && cols[key] === undefined) cols[key] = idx;
  });
  if (cols.email === undefined) {
    return { rows, errors: [{ line: 1, message: 'Missing the "email" column in the header row.' }] };
  }

  const data: { line: number; r: string[] }[] = [];
  for (let k = headerIdx + 1; k < records.length; k++) {
    if (!isBlank(records[k])) data.push({ line: k + 1, r: records[k] });
  }
  if (data.length > BULK_MAX_ROWS) {
    return {
      rows,
      errors: [{ line: 1, message: `Too many rows (${data.length}). The limit is ${BULK_MAX_ROWS} per file.` }],
    };
  }

  const get = (r: string[], key: string) => (cols[key] === undefined ? '' : (r[cols[key]] ?? '').trim());
  const seen = new Map<string, number>();
  for (const { line, r } of data) {
    const email = get(r, 'email').toLowerCase();
    const fullName = get(r, 'full_name');
    const roleRaw = get(r, 'role').toLowerCase();
    const cohort = get(r, 'cohort') || 'General';
    const fail = (message: string) => errors.push({ line, email: email || undefined, message });

    if (!email) { fail('Email is required'); continue; }
    if (email.length > 254 || !EMAIL_RE.test(email)) { fail('Not a valid email address'); continue; }
    const domain = email.split('@')[1];
    if (domain === 'example.com' || domain === 'example.org') { fail("Remove the template's example rows"); continue; }
    if (fullName.length > 120) { fail('Name is longer than 120 characters'); continue; }
    if (cohort.length > 60) { fail('Cohort is longer than 60 characters'); continue; }
    const role = roleRaw || 'student';
    if (role === 'admin') { fail('Admins must be invited one at a time'); continue; }
    if (!(BULK_ROLES as readonly string[]).includes(role)) {
      fail(`Role must be one of: ${BULK_ROLES.join(', ')}`);
      continue;
    }
    const prior = seen.get(email);
    if (prior !== undefined) { fail(`Duplicate of row ${prior}`); continue; }
    seen.set(email, line);
    rows.push({ line, email, fullName, role: role as BulkRole, cohort });
  }
  return { rows, errors };
}

export function buildTemplateCsv(): string {
  return [
    BULK_TEMPLATE_HEADERS.join(','),
    'student.example@example.com,Example Student,student,Sec 3A',
    'teacher.example@example.com,Example Teacher,teacher,Economics',
  ].join('\r\n') + '\r\n';
}
