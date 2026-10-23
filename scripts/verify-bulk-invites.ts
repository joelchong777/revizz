/**
 * Bulk user upload: parser, validator, template, route and email static checks.
 * Run: npx tsx scripts/verify-bulk-invites.ts
 */
import fs from 'fs';
import path from 'path';
import {
  BULK_TEMPLATE_HEADERS,
  BULK_TEMPLATE_PATH,
  BULK_MAX_ROWS,
  BULK_CHUNK_SIZE,
  parseCsv,
  validateBulkRows,
  buildTemplateCsv,
} from '../lib/bulkInvites';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) {
    failed++;
    if (detail !== undefined) console.log('      got:', JSON.stringify(detail));
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const H = 'email,full_name,role,cohort\n';

// ---- parseCsv
check('parseCsv: quoted comma', eq(parseCsv('a,"b,c",d'), [['a', 'b,c', 'd']]), parseCsv('a,"b,c",d'));
check('parseCsv: "" escape', eq(parseCsv('a,"say ""hi""",d'), [['a', 'say "hi"', 'd']]), parseCsv('a,"say ""hi""",d'));
check('parseCsv: newline inside quotes', eq(parseCsv('a,"x\ny",d\nq,r,s'), [['a', 'x\ny', 'd'], ['q', 'r', 's']]), parseCsv('a,"x\ny",d\nq,r,s'));
check('parseCsv: CRLF', eq(parseCsv('a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]), parseCsv('a,b\r\nc,d\r\n'));
check('parseCsv: BOM stripped', eq(parseCsv('﻿a,b\nc,d'), [['a', 'b'], ['c', 'd']]), parseCsv('﻿a,b\nc,d'));
check('parseCsv: blank lines dropped', eq(parseCsv('a,b\n\n   \nc,d\n\n'), [['a', 'b'], ['c', 'd']]), parseCsv('a,b\n\n   \nc,d\n\n'));
check('parseCsv: semicolon file', eq(parseCsv('email;role\nx@y.com;student'), [['email', 'role'], ['x@y.com', 'student']]), parseCsv('email;role\nx@y.com;student'));

// ---- validateBulkRows
let r = validateBulkRows(H + 'a@school.sg,Ann Lee,teacher,Sec 3\n');
check('valid row accepted', r.errors.length === 0 && r.rows.length === 1, r);
check('valid row fields', eq(r.rows[0], { line: 2, email: 'a@school.sg', fullName: 'Ann Lee', role: 'teacher', cohort: 'Sec 3' }), r.rows[0]);

r = validateBulkRows('EMAIL , Name , ROLE , Cohort\nb@school.sg,Bob,Student,4A\n');
check('header case/trim + name alias', r.errors.length === 0 && r.rows[0]?.fullName === 'Bob' && r.rows[0]?.role === 'student', r);
r = validateBulkRows('Email Address,Full Name\nc@school.sg,Cy Tan\n');
check('aliases: email address, full name', r.errors.length === 0 && r.rows[0]?.email === 'c@school.sg' && r.rows[0]?.fullName === 'Cy Tan', r);
r = validateBulkRows('name,role\nCy,student\n');
check('missing email column -> one error line 1', r.rows.length === 0 && r.errors.length === 1 && r.errors[0].line === 1, r);
r = validateBulkRows(H + 'not-an-email,X,student,A\n');
check('bad email -> error', r.rows.length === 0 && r.errors.length === 1 && r.errors[0].line === 2, r);
r = validateBulkRows(H + 'ad@school.sg,X,admin,A\n');
check('admin role -> error', r.rows.length === 0 && r.errors.length === 1 && /one at a time/i.test(r.errors[0].message), r);
r = validateBulkRows(H + 'ad@school.sg,X,principal,A\n');
check('unknown role -> error listing allowed', r.rows.length === 0 && r.errors.length === 1 && /student/.test(r.errors[0].message) && /teacher/.test(r.errors[0].message), r);
r = validateBulkRows(H + 'e@school.sg,X,,\n');
check('empty role -> student, empty cohort -> General', r.rows[0]?.role === 'student' && r.rows[0]?.cohort === 'General', r);
r = validateBulkRows(H + 'Mixed.Case@School.SG,,student,A\n');
check('email lowercased, empty name allowed', r.rows[0]?.email === 'mixed.case@school.sg' && r.rows[0]?.fullName === '', r);
r = validateBulkRows(H + 'z@example.com,X,student,A\ny@example.org,X,student,A\n');
check('example.com / example.org rejected', r.rows.length === 0 && r.errors.length === 2 && r.errors.every((e) => /example rows/i.test(e.message)), r);
r = validateBulkRows(H + 'dup@school.sg,A,student,A\nother@school.sg,B,student,A\nDUP@school.sg,C,student,A\n');
check('duplicate flagged on later line with "row N"', r.rows.length === 2 && r.errors.length === 1 && r.errors[0].line === 4 && /row 2/i.test(r.errors[0].message), r);
r = validateBulkRows(H + '\n\nline@school.sg,X,student,A\nbad,X,student,A\n');
check('line numbers are spreadsheet rows (blank rows count)', r.rows.length === 1 && r.rows[0].line === 4 && r.errors.length === 1 && r.errors[0].line === 5, r);
r = validateBulkRows(H + 'ok1@school.sg,X,student,A\nbad,X,student,A\nok2@school.sg,X,student,A\n');
check('erroring rows excluded; later lines keep numbers', eq(r.rows.map((x) => x.line), [2, 4]) && r.errors[0].line === 3, r);
r = validateBulkRows(H + 'a@school.sg,' + 'n'.repeat(121) + ',student,A\n');
check('full_name > 120 -> error', r.rows.length === 0 && r.errors.length === 1, r);
r = validateBulkRows(H + 'a@school.sg,X,student,' + 'c'.repeat(61) + '\n');
check('cohort > 60 -> error', r.rows.length === 0 && r.errors.length === 1, r);

const many = H + Array.from({ length: BULK_MAX_ROWS + 1 }, (_, i) => `u${i}@school.sg,X,student,A`).join('\n') + '\n';
r = validateBulkRows(many);
check('> BULK_MAX_ROWS -> one error line 1, rows []', r.rows.length === 0 && r.errors.length === 1 && r.errors[0].line === 1, { rows: r.rows.length, errors: r.errors.length });
const exact = H + Array.from({ length: BULK_MAX_ROWS }, (_, i) => `u${i}@school.sg,X,student,A`).join('\n') + '\n';
r = validateBulkRows(exact);
check('exactly BULK_MAX_ROWS accepted', r.rows.length === BULK_MAX_ROWS && r.errors.length === 0, { rows: r.rows.length, errors: r.errors.length });

check('constants', BULK_MAX_ROWS === 500 && BULK_CHUNK_SIZE === 25 && eq([...BULK_TEMPLATE_HEADERS], ['email', 'full_name', 'role', 'cohort']));

// ---- template
const tplFile = read('public/templates/revizz-bulk-users-template.csv');
check('template path constant', BULK_TEMPLATE_PATH === '/templates/revizz-bulk-users-template.csv');
check('template file equals buildTemplateCsv()', tplFile === buildTemplateCsv(), { file: tplFile, built: buildTemplateCsv() });
check('template header equals BULK_TEMPLATE_HEADERS', eq(parseCsv(tplFile)[0], [...BULK_TEMPLATE_HEADERS]));
check('template uses CRLF', buildTemplateCsv().includes('\r\n'));
r = validateBulkRows(tplFile);
check('template validates to rows [] with exactly 2 example errors', r.rows.length === 0 && r.errors.length === 2 && r.errors.every((e) => /example/i.test(e.message)), r);

// ---- route static checks
const route = read('app/api/admin/users/bulk/route.ts');
check('route: requireRole(req, [\'admin\'])', /requireRole\(\s*\w+\s*,\s*\[\s*['"]admin['"]\s*\]\s*\)/.test(route));
check('route: exports POST', /export\s+async\s+function\s+POST/.test(route));
check('route: enforces BULK_CHUNK_SIZE', /BULK_CHUNK_SIZE/.test(route) && /length\s*>\s*BULK_CHUNK_SIZE/.test(route));
check('route: 400 response present', /status:\s*400/.test(route));
check("route: uses status 'pending'", /status:\s*['"]pending['"]/.test(route));
check("route: never inserts role 'admin'", !/role:\s*['"]admin['"]/.test(route));
check('route: re-validates server side (imports lib/bulkInvites)', /from\s+['"]@\/lib\/bulkInvites['"]|from\s+['"][./]+\/?lib\/bulkInvites['"]/.test(route));
check('route: uses sendInviteEmail', /sendInviteEmail/.test(route));
check('route: no student/portal token mixing (no getPortalToken/student token reads)', !/portalToken|student_token/i.test(route));

// ---- email
const email = read('lib/email.ts');
const sb = email.slice(email.indexOf('sendSupabaseInvite'));
check('email: sendSupabaseInvite data has needs_password: true', /needs_password:\s*true/.test(sb));

// ---- first-login password (contract)
const auth = read('lib/auth.ts');
check('auth: completeFirstLoginPassword exported, sets needs_password false', /export\s+const\s+completeFirstLoginPassword/.test(auth) && /needs_password:\s*false/.test(auth));

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll bulk invite checks passed');
