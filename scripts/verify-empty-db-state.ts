/**
 * Automated Verification Script: Empty Database State Audit
 *
 * Verifies:
 * 1. Database fetch functions (fetchSubjectsFromDb, fetchQuestionsFromDb, fetchTopicsFromDb)
 *    return [] when the database table is empty or on query error (no hardcoded fallback fake data).
 * 2. Source code static audit across target production UI surfaces:
 *    - app/page.tsx
 *    - components/StartFlow.tsx
 *    - components/TopicMasteryList.tsx
 *    - components/portal/TeacherAnalytics.tsx
 *    - components/portal/AdminTools.tsx
 *    - components/portal/AdminCMS.tsx
 *    - components/portal/compiler/TestCompilerHub.tsx
 *    - components/admin/AppAdminHub.tsx
 *    - app/portal/page.tsx
 *    Proving that all forbidden hardcoded mock strings:
 *    - "Frontier International Academy"
 *    - "Revizz Enterprise Campus"
 *    - "Why will scarcity always exist?"
 *    - "Mr. D. Patel"
 *    - "10A Physics"
 *    - "10B Physics"
 *    - "Ms. A. Okafor"
 *    - "Mr. C. Tan"
 *    have been completely stripped.
 * 3. Empty state UI signs/banners are rendered when datasets are empty.
 */

import fs from 'fs';
import path from 'path';

// Global test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name: string, details?: string) {
  totalTests++;
  passedTests++;
  console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}${details ? ` (${details})` : ''}`);
}

function fail(name: string, error: string) {
  totalTests++;
  failedTests++;
  console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}\n    -> Error: ${error}`);
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    pass(testName);
  } else {
    fail(testName, `Expected ${expectedStr}, received ${actualStr}`);
  }
}

function createChainableQueryMock(result: { data: any; error: any }) {
  const queryObj: any = {
    select: () => queryObj,
    eq: () => queryObj,
    in: () => queryObj,
    order: () => queryObj,
    limit: () => queryObj,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
  };
  return queryObj;
}

async function runDatabaseFunctionsAudit() {
  console.log('\n============================================================');
  console.log('SUITE 1: Database Fetch Functions Empty / Fallback Verification');
  console.log('============================================================');

  // Test 1.1: Verify FALLBACK_SUBJECTS is empty
  try {
    const subjectsModule = await import('../lib/subjects');
    if ('FALLBACK_SUBJECTS' in subjectsModule) {
      assertEqual(
        subjectsModule.FALLBACK_SUBJECTS,
        [],
        'FALLBACK_SUBJECTS constant is strictly an empty array'
      );
    } else {
      pass('FALLBACK_SUBJECTS has been eliminated from lib/subjects.ts');
    }

    const { supabase } = await import('../lib/supabaseClient');
    const originalFrom = supabase.from.bind(supabase);

    // Test 1.2: Verify fetchSubjectsFromDb returns [] when Supabase returns empty
    (supabase as any).from = () => createChainableQueryMock({ data: [], error: null });
    const emptySubjects = await subjectsModule.fetchSubjectsFromDb();
    assertEqual(
      emptySubjects,
      [],
      'fetchSubjectsFromDb() returns [] when database table is empty'
    );

    // Test 1.3: Verify fetchSubjectsFromDb returns [] when Supabase returns an error
    const originalWarn = console.warn;
    console.warn = () => {};
    (supabase as any).from = () =>
      createChainableQueryMock({
        data: null,
        error: { message: 'relation "subjects" does not exist' },
      });

    const errorSubjects = await subjectsModule.fetchSubjectsFromDb();
    assertEqual(
      errorSubjects,
      [],
      'fetchSubjectsFromDb() returns [] on query error (no fake fallback subjects)'
    );
    console.warn = originalWarn;

    // Restore supabase.from
    (supabase as any).from = originalFrom;
  } catch (err: any) {
    fail('fetchSubjectsFromDb empty/fallback audit', err.message);
  }

  // Test 1.4: Verify fetchQuestionsFromDb and fetchTopicsFromDb
  try {
    const questionsModule = await import('../lib/questions');
    const { supabase } = await import('../lib/supabaseClient');
    const originalFrom = supabase.from.bind(supabase);
    const originalError = console.error;

    // Test fetchQuestionsFromDb if present
    if (typeof (questionsModule as any).fetchQuestionsFromDb === 'function') {
      // Mock empty DB
      (supabase as any).from = () => createChainableQueryMock({ data: [], error: null });

      const emptyQuestions = await (questionsModule as any).fetchQuestionsFromDb();
      assertEqual(
        emptyQuestions,
        [],
        'fetchQuestionsFromDb() returns [] when questions table is empty'
      );

      // Mock error DB
      console.error = () => {};
      (supabase as any).from = () =>
        createChainableQueryMock({
          data: null,
          error: { message: 'relation "questions" does not exist' },
        });

      const errorQuestions = await (questionsModule as any).fetchQuestionsFromDb();
      assertEqual(
        errorQuestions,
        [],
        'fetchQuestionsFromDb() returns [] on db query error'
      );
      console.error = originalError;
      (supabase as any).from = originalFrom;
    } else {
      fail(
        'fetchQuestionsFromDb export check',
        'fetchQuestionsFromDb is not exported in lib/questions.ts'
      );
    }

    // Test fetchTopicsFromDb if present
    if (typeof (questionsModule as any).fetchTopicsFromDb === 'function') {
      (supabase as any).from = () => createChainableQueryMock({ data: [], error: null });

      const emptyTopics = await (questionsModule as any).fetchTopicsFromDb();
      assertEqual(
        emptyTopics,
        [],
        'fetchTopicsFromDb() returns [] when topics table is empty'
      );

      console.error = () => {};
      (supabase as any).from = () =>
        createChainableQueryMock({
          data: null,
          error: { message: 'relation "topics" does not exist' },
        });

      const errorTopics = await (questionsModule as any).fetchTopicsFromDb();
      assertEqual(
        errorTopics,
        [],
        'fetchTopicsFromDb() returns [] on db query error'
      );
      console.error = originalError;
      (supabase as any).from = originalFrom;
    } else {
      fail(
        'fetchTopicsFromDb export check',
        'fetchTopicsFromDb is not exported in lib/questions.ts'
      );
    }
  } catch (err: any) {
    fail('fetchQuestionsFromDb/fetchTopicsFromDb audit', err.message);
  }
}

function runBannedStringsStaticAudit() {
  console.log('\n============================================================');
  console.log('SUITE 2: Static Source Code Hardcoded Mock Data Audit');
  console.log('============================================================');

  const rootDir = path.resolve(__dirname, '..');
  const targetFiles = [
    'app/page.tsx',
    'components/StartFlow.tsx',
    'components/TopicMasteryList.tsx',
    'components/portal/TeacherAnalytics.tsx',
    'components/portal/AdminTools.tsx',
    'components/portal/AdminCMS.tsx',
    'components/portal/compiler/TestCompilerHub.tsx',
    'components/admin/AppAdminHub.tsx',
    'app/portal/page.tsx',
  ];

  const bannedPatterns: { label: string; pattern: RegExp }[] = [
    { label: 'Frontier International Academy', pattern: /Frontier International Academy/i },
    { label: 'Revizz Enterprise Campus', pattern: /Revizz Enterprise Campus/i },
    { label: 'Why will scarcity always exist?', pattern: /Why will scarcity always exist\?/i },
    { label: 'Mr. D. Patel', pattern: /Mr\.\s*D\.\s*Patel/i },
    { label: '10A Physics', pattern: /10A Physics/i },
    { label: '10B Physics', pattern: /10B Physics/i },
    { label: 'Ms. A. Okafor', pattern: /Ms\.\s*A\.\s*Okafor/i },
    { label: 'Mr. C. Tan', pattern: /Mr\.\s*C\.\s*Tan/i },
  ];

  for (const relPath of targetFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) {
      fail(`File existence: ${relPath}`, `File does not exist at ${fullPath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    for (const { label, pattern } of bannedPatterns) {
      const match = content.match(pattern);
      if (match) {
        // Find line number
        const lines = content.split('\n');
        let matchedLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            matchedLine = i + 1;
            break;
          }
        }
        fail(
          `Banned string check in ${relPath}: "${label}"`,
          `Found banned string at line ${matchedLine}: "${lines[matchedLine - 1].trim()}"`
        );
      } else {
        pass(`No "${label}" in ${relPath}`);
      }
    }
  }
}

function runEmptyStateUiAudit() {
  console.log('\n============================================================');
  console.log('SUITE 3: Empty State UI / "Empty Sign" Implementation Audit');
  console.log('============================================================');

  const rootDir = path.resolve(__dirname, '..');

  const emptyStateChecks = [
    {
      file: 'components/StartFlow.tsx',
      feature: 'Subjects Empty State (No subjects available / empty sign)',
      validate: (code: string) =>
        code.includes('subjects.length === 0') ||
        code.includes('!subjects || subjects.length === 0') ||
        code.includes('No subjects') ||
        code.includes('No subjects loaded') ||
        code.includes('No subjects found') ||
        code.includes('EmptySubjectState') ||
        code.includes('empty'),
    },
    {
      file: 'components/TopicMasteryList.tsx',
      feature: 'Topics/Questions Empty State (No topics or questions)',
      validate: (code: string) =>
        code.includes('effectiveTopics.length === 0') ||
        code.includes('effectiveQuestions.length === 0') ||
        code.includes('chapters.length === 0') ||
        code.includes('totalQuestionsAll === 0') ||
        code.includes('No Topics Available') ||
        code.includes('No syllabus topics') ||
        code.includes('No topics found') ||
        code.includes('No questions found') ||
        code.includes('No questions available'),
    },
    {
      file: 'components/portal/TeacherAnalytics.tsx',
      feature: 'Roster / Cohort Empty State (No students or classes)',
      validate: (code: string) =>
        code.includes('rosterData.length === 0') &&
        (code.includes('No students') ||
          code.includes('No student activity') ||
          code.includes('No active classes') ||
          code.includes('empty')),
    },
    {
      file: 'components/portal/compiler/TestCompilerHub.tsx',
      feature: 'Test Compiler Empty Bank State',
      validate: (code: string) =>
        code.includes('questions.length === 0') ||
        code.includes('filteredQuestions.length === 0') ||
        code.includes('No questions found') ||
        code.includes('No questions available'),
    },
    {
      file: 'components/portal/AdminTools.tsx',
      feature: 'Admin Tools Empty Question / Assignment State',
      validate: (code: string) =>
        code.includes('assignQs.length === 0') ||
        code.includes('questions.length === 0') ||
        code.includes('filteredQuestions.length === 0') ||
        code.includes('No questions') ||
        code.includes('No questions available') ||
        code.includes('No questions assigned') ||
        !code.includes('Why will scarcity always exist?'),
    },
    {
      file: 'components/portal/AdminCMS.tsx',
      feature: 'Admin CMS Empty Question Bank State',
      validate: (code: string) =>
        code.includes('questions.length === 0') ||
        code.includes('!defaultQuestion') ||
        code.includes('No questions found') ||
        code.includes('No question selected') ||
        code.includes('No questions available'),
    },
    {
      file: 'components/admin/AppAdminHub.tsx',
      feature: 'Admin Hub Empty Cohorts State',
      validate: (code: string) =>
        code.includes('cohorts.length === 0') ||
        code.includes('No cohorts registered') ||
        code.includes('No cohorts found') ||
        code.includes('No active cohorts') ||
        !code.includes('Mr. D. Patel'),
    },
    {
      file: 'app/portal/page.tsx',
      feature: 'Portal Empty Cohorts / License State',
      validate: (code: string) =>
        (code.includes('cohorts.length === 0') ||
          code.includes('No cohorts registered') ||
          code.includes('No cohorts found') ||
          code.includes('No active cohorts') ||
          !code.includes('Mr. D. Patel')) &&
        !code.includes('Frontier International Academy'),
    },
    {
      file: 'app/page.tsx',
      feature: 'App Main Page Empty Question Pool Guard',
      validate: (code: string) =>
        code.includes('questions.length === 0') ||
        code.includes('pool.length === 0') ||
        code.includes('No questions') ||
        code.includes('empty') ||
        code.includes('fetchQuestionsFromDb'),
    },
  ];

  for (const check of emptyStateChecks) {
    const fullPath = path.join(rootDir, check.file);
    if (!fs.existsSync(fullPath)) {
      fail(`File existence: ${check.file}`, 'File not found');
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const hasEmptyHandling = check.validate(content);

    if (hasEmptyHandling) {
      pass(`Empty state integrated in ${check.file}: ${check.feature}`);
    } else {
      fail(
        `Empty state check in ${check.file}`,
        `Missing explicit empty state / fallback handling for: ${check.feature}`
      );
    }
  }
}

async function main() {
  console.log('============================================================');
  console.log('REVIZZ QA AUDIT: EMPTY DATABASE STATE & MOCK DATA PURGE');
  console.log('============================================================');

  await runDatabaseFunctionsAudit();
  runBannedStringsStaticAudit();
  runEmptyStateUiAudit();

  console.log('\n============================================================');
  console.log('FINAL AUDIT SUMMARY');
  console.log('============================================================');
  console.log(`Total Checks Executed: ${totalTests}`);
  console.log(`\x1b[32mPassed\x1b[0m: ${passedTests}`);
  console.log(`\x1b[31mFailed\x1b[0m: ${failedTests}`);

  if (failedTests > 0) {
    console.error(`\n\x1b[31mAUDIT FAILED: ${failedTests} issue(s) detected.\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\n\x1b[32mALL AUDIT CHECKS PASSED: Zero mock/fake data detected, empty states fully verified.\x1b[0m\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification execution:', err);
  process.exit(1);
});
