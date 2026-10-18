/**
 * Verification Script: Fake Data & Mock Identity Purge Auditor
 * 
 * Audits source files across Portal, Admin, Navigation, Compiler, and Auth to ensure
 * zero occurrences of hardcoded mock teachers, students, schools, and fake email domains.
 * 
 * Run with: npx tsx scripts/verify-fake-data-purge.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const TARGET_FILES = [
  'components/admin/AdminSettingsHub.tsx',
  'components/admin/AppAdminHub.tsx',
  'components/admin/UserManagementHub.tsx',
  'components/portal/AdminNav.tsx',
  'components/Header.tsx',
  'components/portal/compiler/TestCompilerHub.tsx',
  'components/portal/TeacherAnalytics.tsx',
  'components/StartFlow.tsx',
  'components/StudentAuthGate.tsx',
  'lib/auth.ts',
];

const FORBIDDEN_PATTERNS = [
  'Dr. Jane Smith',
  'Marcus Vance',
  'Sarah Jenkins',
  'Mr. D. Patel',
  'Ms. A. Okafor',
  'Mr. C. Tan',
  'Alex M.',
  'Frontier International Academy',
  "Frontier Int'l",
  'frontier.edu',
  'revizz.edu',
];

interface Finding {
  file: string;
  line: number;
  pattern: string;
  context: string;
}

function runAudit(): boolean {
  console.log('='.repeat(70));
  console.log('🔍 Revizz Fake Data & Mock Identity Purge Audit');
  console.log('='.repeat(70));

  const findings: Finding[] = [];
  const baseDir = process.cwd();

  for (const relPath of TARGET_FILES) {
    const fullPath = path.resolve(baseDir, relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Warning: File not found: ${relPath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (line.includes(pattern)) {
          findings.push({
            file: relPath,
            line: index + 1,
            pattern,
            context: line.trim(),
          });
        }
      }
    });
  }

  if (findings.length > 0) {
    console.error(`\n❌ FAILED: Found ${findings.length} forbidden mock data occurrence(s):\n`);
    findings.forEach((f) => {
      console.error(`  [${f.file}:${f.line}] Found: "${f.pattern}"`);
      console.error(`     > ${f.context}\n`);
    });
    console.error('Audit failed. Please remove all hardcoded mock identities.');
    return false;
  }

  console.log(`\n✅ PASSED: 0 forbidden strings found across ${TARGET_FILES.length} target files.`);
  console.log('Checked patterns:');
  FORBIDDEN_PATTERNS.forEach((p) => console.log(`  - "${p}"`));
  console.log('\nAll checked files are free from fake/mock identities!');
  console.log('='.repeat(70));
  return true;
}

const success = runAudit();
if (!success) {
  process.exit(1);
} else {
  process.exit(0);
}
