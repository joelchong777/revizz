/**
 * Standalone Verification Script for Test Compiler Print Pipeline.
 *
 * Verifies:
 * 1. buildCompiledQuestions with custom Supabase pool and fallback to CAMBRIDGE_QUESTIONS
 * 2. Diagram URL resolution on compiled questions
 * 3. autoSelectQuestions with pool and fallback
 * 4. TestPaperConfig.compiledQuestions persistence via saveTestDraft / loadTestDraft
 * 5. Static contract audit on app/portal/compiler/print/page.tsx and TestCompilerHub.tsx
 */

import fs from 'fs';
import path from 'path';
import {
  buildCompiledQuestions,
  autoSelectQuestions,
  saveTestDraft,
  loadTestDraft,
} from '../lib/testCompiler';
import { CAMBRIDGE_QUESTIONS, Question } from '../lib/questions';
import { TestPaperConfig } from '../types/testCompiler';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  passed++;
  console.log(`✅ [PASS] ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('       TEST COMPILER PRINT PIPELINE VERIFICATION                ');
  console.log('================================================================\n');

  // 1. buildCompiledQuestions fallback to CAMBRIDGE_QUESTIONS
  const cambridgeIds = CAMBRIDGE_QUESTIONS.slice(0, 3).map((q) => q.id);
  const compiledFromCambridge = buildCompiledQuestions(cambridgeIds);
  assert(
    compiledFromCambridge.length === 3,
    `buildCompiledQuestions correctly falls back to CAMBRIDGE_QUESTIONS (got ${compiledFromCambridge.length}, expected 3)`
  );
  assert(
    compiledFromCambridge[0].questionNumber === 1 && compiledFromCambridge[1].questionNumber === 2,
    'buildCompiledQuestions numbers questions sequentially starting from 1'
  );
  assert(
    compiledFromCambridge[0].options.some((o) => o.isCorrect === true),
    'buildCompiledQuestions correctly maps isCorrect option'
  );

  // 2. buildCompiledQuestions with custom pool (UUIDs from Supabase)
  const mockDbQuestions: Question[] = [
    {
      id: 'b7b1e7df-830d-42d0-a033-1aefbffe1ac9',
      stem_markdown: 'What is opportunity cost?',
      options: [
        { id: 'opt-1', text_markdown: 'The next best alternative forgone' },
        { id: 'opt-2', text_markdown: 'The financial cost of an investment' },
      ],
      correct_option_id: 'opt-1',
      citation: 'Cambridge IGCSE Economics 0455/13 Oct/Nov 2024 Q18',
      topic: 'The basic economic problem',
      image_url: '/questions/0455_2024_w_13_q18.png',
      has_diagram: true,
    },
    {
      id: 'c3135948-9b5e-4c5a-b759-3bce823ba907',
      stem_markdown: 'What causes a shift in demand?',
      options: [
        { id: 'opt-3', text_markdown: 'Change in income' },
        { id: 'opt-4', text_markdown: 'Change in price' },
      ],
      correct_option_id: 'opt-3',
      citation: 'Cambridge IGCSE Economics 0455/13 Oct/Nov 2024 Q3',
      topic: 'The allocation of resources',
    },
  ];

  const dbIds = mockDbQuestions.map((q) => q.id);
  const compiledFromDb = buildCompiledQuestions(dbIds, mockDbQuestions);
  assert(
    compiledFromDb.length === 2,
    `buildCompiledQuestions compiles questions from custom Supabase pool (got ${compiledFromDb.length}, expected 2)`
  );
  assert(
    compiledFromDb[0].id === 'b7b1e7df-830d-42d0-a033-1aefbffe1ac9',
    'Compiled question preserves Supabase question UUID'
  );
  assert(
    typeof compiledFromDb[0].imageUrl === 'string' &&
      compiledFromDb[0].imageUrl.includes('question-diagrams') &&
      compiledFromDb[0].imageUrl.includes('0455_2024_w_13_q18.png'),
    'Compiled question resolves diagram URL to public Supabase Storage CDN endpoint'
  );

  // 3. autoSelectQuestions pool and fallback
  const autoSelectedFromCambridge = autoSelectQuestions({ count: 5 });
  assert(
    autoSelectedFromCambridge.length === 5,
    `autoSelectQuestions falls back to CAMBRIDGE_QUESTIONS when no pool provided (got ${autoSelectedFromCambridge.length}, expected 5)`
  );

  const autoSelectedFromPool = autoSelectQuestions({ count: 2 }, mockDbQuestions);
  assert(
    autoSelectedFromPool.length === 2 && dbIds.includes(autoSelectedFromPool[0]),
    'autoSelectQuestions selects from provided pool when supplied'
  );

  // 4. Persistence of compiledQuestions in localStorage mock
  const storageMap = new Map<string, string>();
  (global as any).window = {};
  (global as any).localStorage = {
    setItem: (k: string, v: string) => storageMap.set(k, v),
    getItem: (k: string) => storageMap.get(k) || null,
    length: storageMap.size,
    key: (i: number) => Array.from(storageMap.keys())[i],
  };

  const testConfig: TestPaperConfig = {
    id: 'test-print-sample-123',
    title: 'Economics Term 1 Exam',
    subjectCode: '0455',
    subjectName: 'Economics',
    schoolName: 'Frontier Academy',
    durationMinutes: 45,
    totalMarks: compiledFromDb.length,
    testCode: 'REV-0455-TEST',
    dateString: 'October 2026',
    includeCoverPage: true,
    includeCandidateHeader: false,
    includeBubbleSheet: true,
    includeMarkScheme: true,
    questionIds: dbIds,
    compiledQuestions: compiledFromDb,
    createdAt: new Date().toISOString(),
  };

  saveTestDraft(testConfig);
  const reloaded = loadTestDraft('test-print-sample-123');

  assert(
    reloaded !== null && reloaded.id === 'test-print-sample-123',
    'saveTestDraft & loadTestDraft successfully persist draft'
  );
  assert(
    reloaded?.compiledQuestions !== undefined && reloaded.compiledQuestions.length === 2,
    `loaded draft retains compiledQuestions snapshot (${reloaded?.compiledQuestions?.length} questions)`
  );
  assert(
    reloaded?.compiledQuestions?.[0]?.imageUrl?.includes('question-diagrams') === true,
    'reloaded compiled question retains resolved CDN imageUrl'
  );

  // 5. Code audit of TestCompilerHub and print/page.tsx
  const hubCode = fs.readFileSync(
    path.resolve(__dirname, '../components/portal/compiler/TestCompilerHub.tsx'),
    'utf-8'
  );
  assert(
    hubCode.includes('buildCompiledQuestions(selectedQuestionIds, questions)'),
    'TestCompilerHub compiles questions snapshot with active questions pool at generateConfig'
  );
  assert(
    hubCode.includes('compiledQuestions: compiled'),
    'TestCompilerHub includes compiledQuestions in TestPaperConfig'
  );

  const printPageCode = fs.readFileSync(
    path.resolve(__dirname, '../app/portal/compiler/print/page.tsx'),
    'utf-8'
  );
  assert(
    printPageCode.includes('loadedConfig.compiledQuestions && loadedConfig.compiledQuestions.length > 0'),
    'print/page.tsx checks and immediately uses loadedConfig.compiledQuestions'
  );
  assert(
    printPageCode.includes('fetchQuestionsFromDb'),
    'print/page.tsx includes async fallback to fetchQuestionsFromDb for unsynced drafts'
  );
  assert(
    printPageCode.includes('Draft Not Found') && printPageCode.includes('Load Sample Demo'),
    'print/page.tsx renders tactile Neobrutalist error card with demo fallback'
  );
  assert(
    printPageCode.includes('Compiling Printable Exam'),
    'print/page.tsx includes tactile loading state'
  );

  console.log(`\n================================================================`);
  console.log(`Results: ${passed}/${total} checks passed (100%)`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
