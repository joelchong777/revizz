/**
 * Standalone Verification Test Script: verify-compiler-print.ts
 *
 * Verifies:
 * 1. buildCompiledQuestions(questionIds, pool) compiles real questions with UUIDs when passed a pool.
 * 2. buildCompiledQuestions(questionIds) falls back to CAMBRIDGE_QUESTIONS when IDs match mock data.
 * 3. saveTestDraft and loadTestDraft serialize and deserialize compiledQuestions snapshots without data loss.
 * 4. End-to-end Supabase query: fetches real DB questions, compiles them, and validates:
 *    - Array length matches requested count
 *    - Valid stemMarkdown
 *    - Exactly 4 options labeled A-D with exactly one isCorrect === true
 *    - Valid imageUrl matching resolveDiagramUrl for questions with diagrams
 * 5. autoSelectQuestions samples questions correctly from dynamic question pools.
 */

// Polyfill browser environment for localStorage and window in Node runtime
const memoryStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string): string | null => memoryStore.get(key) || null,
  setItem: (key: string, value: string): void => {
    memoryStore.set(key, String(value));
  },
  removeItem: (key: string): void => {
    memoryStore.delete(key);
  },
  clear: (): void => {
    memoryStore.clear();
  },
  key: (index: number): string | null => Array.from(memoryStore.keys())[index] || null,
  get length(): number {
    return memoryStore.size;
  },
};
(globalThis as any).window = globalThis;

import { supabase } from '../lib/supabaseClient';
import {
  buildCompiledQuestions,
  autoSelectQuestions,
  saveTestDraft,
  loadTestDraft,
} from '../lib/testCompiler';
import {
  Question,
  CAMBRIDGE_QUESTIONS,
  fetchQuestionsFromDb,
  resolveDiagramUrl,
} from '../lib/questions';
import { TestPaperConfig, CompiledExamQuestion } from '../types/testCompiler';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details: string;
  durationMs?: number;
}

const results: TestResult[] = [];

function recordResult(name: string, category: string, passed: boolean, details: string, durationMs?: number) {
  results.push({ name, category, passed, details, durationMs });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${category}] ${name}: ${details}${durationMs !== undefined ? ` (${durationMs}ms)` : ''}`);
}

async function testDynamicPoolCompilation() {
  console.log('\n--- 1. Testing buildCompiledQuestions with Dynamic Pool (UUIDs) ---');

  const mockUuidPool: Question[] = [
    {
      id: 'f87a2245-1234-4567-89ab-cdef01234567',
      stem_markdown: 'What is the primary motive of private sector firms in a market economy?',
      options: [
        { id: 'opt-1', text_markdown: 'Maximizing profit' },
        { id: 'opt-2', text_markdown: 'Minimizing employment' },
        { id: 'opt-3', text_markdown: 'Providing public goods' },
        { id: 'opt-4', text_markdown: 'Achieving equitable distribution' },
      ],
      correct_option_id: 'opt-1',
      citation: 'Cambridge 0455/12/M/J/24 Q1',
      topic: 'The Allocation of Resources',
      topic_id: 'topic-resource-allocation',
      has_diagram: false,
    },
    {
      id: 'a12b3344-9876-5432-ba98-fedcba987654',
      stem_markdown: 'The diagram shows demand and supply curves for apples. What causes the shift from D1 to D2?',
      options: [
        { id: 'opt-a', text_markdown: 'An increase in consumers’ disposable income' },
        { id: 'opt-b', text_markdown: 'A fall in apple harvesting costs' },
        { id: 'opt-c', text_markdown: 'A tax imposed on fruit growers' },
        { id: 'opt-d', text_markdown: 'A decrease in population size' },
      ],
      correct_option_id: 'opt-a',
      citation: 'Cambridge 0455/12/M/J/24 Q2',
      topic: 'Microeconomic Decision Makers',
      topic_id: 'topic-micro',
      has_diagram: true,
      image_url: 'https://dmvahcaxixvhgxidmkqs.supabase.co/storage/v1/object/public/question-diagrams/0455_2024_w_13_q18.png',
    },
  ];

  const targetIds = [
    'f87a2245-1234-4567-89ab-cdef01234567',
    'a12b3344-9876-5432-ba98-fedcba987654',
  ];

  const compiled = buildCompiledQuestions(targetIds, mockUuidPool);

  const lengthPass = compiled.length === 2;
  recordResult(
    'Compile questions with UUIDs from pool',
    'Dynamic Pool Compilation',
    lengthPass,
    `Compiled ${compiled.length} of 2 requested questions`
  );

  const q1 = compiled[0];
  const q1Pass =
    q1 &&
    q1.questionNumber === 1 &&
    q1.id === targetIds[0] &&
    q1.options.length === 4 &&
    q1.options[0].label === 'A' &&
    q1.options[0].isCorrect === true &&
    q1.options.filter((o) => o.isCorrect).length === 1;

  recordResult(
    'Validate compiled question 1 structure & single correct option',
    'Dynamic Pool Compilation',
    Boolean(q1Pass),
    q1Pass ? `Q1 validated (correct option: ${q1.options.find((o) => o.isCorrect)?.label})` : 'Q1 structure mismatch'
  );

  const q2 = compiled[1];
  const q2Pass =
    q2 &&
    q2.questionNumber === 2 &&
    q2.id === targetIds[1] &&
    q2.imageUrl === mockUuidPool[1].image_url &&
    q2.options.length === 4;

  recordResult(
    'Validate compiled question 2 with diagram imageUrl',
    'Dynamic Pool Compilation',
    Boolean(q2Pass),
    q2Pass ? `Q2 imageUrl verified: ${q2.imageUrl}` : 'Q2 diagram mismatch'
  );
}

async function testCambridgeFallback() {
  console.log('\n--- 2. Testing Fallback to CAMBRIDGE_QUESTIONS when Pool is Omitted ---');

  const mockIds = CAMBRIDGE_QUESTIONS.slice(0, 3).map((q) => q.id);

  // Call buildCompiledQuestions with only mockIds (no pool provided)
  const compiled = buildCompiledQuestions(mockIds);

  const pass = compiled.length === 3 && compiled.every((c, idx) => c.id === mockIds[idx]);
  recordResult(
    'Fallback to CAMBRIDGE_QUESTIONS when pool omitted',
    'Static Mock Fallback',
    pass,
    `Returned ${compiled.length} compiled questions from fallback pool`
  );
}

async function testDraftSnapshotSerialization() {
  console.log('\n--- 3. Testing Draft Serialization & Deserialization with compiledQuestions Snapshot ---');

  const testDraftId = `draft-test-${Date.now()}`;
  const compiledSnapshot: CompiledExamQuestion[] = [
    {
      questionNumber: 1,
      id: 'uuid-sample-1',
      stemMarkdown: 'What is the definition of inflation?',
      imageUrl: 'https://dmvahcaxixvhgxidmkqs.supabase.co/storage/v1/object/public/question-diagrams/0455_2024_w_13_q18.png',
      options: [
        { label: 'A', textMarkdown: 'A sustained increase in the general price level', isCorrect: true },
        { label: 'B', textMarkdown: 'An increase in the price of food only', isCorrect: false },
        { label: 'C', textMarkdown: 'A rise in interest rates', isCorrect: false },
        { label: 'D', textMarkdown: 'A decrease in taxation', isCorrect: false },
      ],
      citation: 'Cambridge Economics 0455/12/M/J/24 Q1',
      topic: 'Economic Indicators',
      explanationMarkdown: 'Inflation is defined as a general and sustained rise in prices.',
    },
    {
      questionNumber: 2,
      id: 'uuid-sample-2',
      stemMarkdown: 'Which policy is an example of monetary policy?',
      options: [
        { label: 'A', textMarkdown: 'Increasing government spending', isCorrect: false },
        { label: 'B', textMarkdown: 'Lowering the central bank base interest rate', isCorrect: true },
        { label: 'C', textMarkdown: 'Imposing tariffs on imported goods', isCorrect: false },
        { label: 'D', textMarkdown: 'Privatizing state-owned enterprises', isCorrect: false },
      ],
      citation: 'Cambridge Economics 0455/12/M/J/24 Q2',
      topic: 'Monetary Policy',
    },
  ];

  const draftConfig: TestPaperConfig = {
    id: testDraftId,
    title: 'Snapshot Verification Test Paper',
    subjectCode: '0455',
    subjectName: 'Economics',
    schoolName: 'Frontier Academy',
    durationMinutes: 45,
    totalMarks: 2,
    testCode: 'TEST-SNAP-01',
    dateString: 'October 2026',
    includeCoverPage: true,
    includeCandidateHeader: false,
    includeBubbleSheet: true,
    includeMarkScheme: true,
    instructionsText: 'Answer all questions on the bubble sheet.',
    questionIds: ['uuid-sample-1', 'uuid-sample-2'],
    compiledQuestions: compiledSnapshot,
    createdAt: new Date().toISOString(),
  };

  saveTestDraft(draftConfig);
  const reloaded = loadTestDraft(testDraftId);

  const reloadedPass =
    reloaded !== null &&
    reloaded.id === testDraftId &&
    reloaded.title === draftConfig.title &&
    Array.isArray(reloaded.compiledQuestions) &&
    reloaded.compiledQuestions.length === 2 &&
    reloaded.compiledQuestions[0].stemMarkdown === compiledSnapshot[0].stemMarkdown &&
    reloaded.compiledQuestions[0].imageUrl === compiledSnapshot[0].imageUrl &&
    reloaded.compiledQuestions[0].options.length === 4 &&
    reloaded.compiledQuestions[0].options[0].isCorrect === true;

  recordResult(
    'Save and reload draft with compiledQuestions snapshot',
    'Draft Persistence',
    Boolean(reloadedPass),
    reloadedPass
      ? `Successfully preserved ${reloaded?.compiledQuestions?.length} compiled questions across serialization`
      : 'Failed to reload or preserve compiledQuestions snapshot'
  );
}

async function testSupabaseEndToEnd() {
  console.log('\n--- 4. Testing End-to-End Supabase DB Query, Compilation & Diagram URLs ---');

  const start = Date.now();
  // Fetch real questions from Supabase (combining text and diagram questions)
  const { data: generalRows, error: genError } = await supabase
    .from('questions')
    .select('id, question_number, stem_markdown, image_url')
    .not('stem_markdown', 'is', null)
    .limit(5);

  const { data: diagramRows, error: diagError } = await supabase
    .from('questions')
    .select('id, question_number, stem_markdown, image_url')
    .not('image_url', 'is', null)
    .limit(5);

  const dbRows = [...(generalRows || []), ...(diagramRows || [])];
  if (genError || diagError || dbRows.length === 0) {
    recordResult(
      'Fetch batch of questions from Supabase',
      'Supabase Integration',
      false,
      `Failed to query Supabase: ${(genError || diagError)?.message || '0 questions returned'}`
    );
    return;
  }

  // Deduplicate IDs
  const sampleIds = Array.from(new Set(dbRows.map((r) => r.id)));
  recordResult(
    'Fetch batch of question IDs from Supabase',
    'Supabase Integration',
    true,
    `Retrieved ${sampleIds.length} real question UUIDs from questions table (${diagramRows?.length || 0} diagram questions)`
  );

  // Call fetchQuestionsFromDb with questionIds
  const fetchedQuestions = await fetchQuestionsFromDb({ questionIds: sampleIds });
  const fetchPass = fetchedQuestions.length === sampleIds.length;
  recordResult(
    'fetchQuestionsFromDb({ questionIds })',
    'Supabase Integration',
    fetchPass,
    `Fetched ${fetchedQuestions.length} full question records with options and relations`
  );

  // Compile with buildCompiledQuestions
  const compiled = buildCompiledQuestions(sampleIds, fetchedQuestions);
  const compilePass = compiled.length === sampleIds.length;
  recordResult(
    'buildCompiledQuestions(sampleIds, fetchedQuestions)',
    'Supabase Integration',
    compilePass,
    `Compiled ${compiled.length} exam questions from real DB data`,
    Date.now() - start
  );

  // Verify structure of every compiled question
  let allValid = true;
  let diagramCount = 0;
  let diagramValid = true;

  compiled.forEach((q, idx) => {
    // 1. Valid stem
    if (!q.stemMarkdown || q.stemMarkdown.trim().length === 0) {
      allValid = false;
    }

    // 2. Question number ordering
    if (q.questionNumber !== idx + 1) {
      allValid = false;
    }

    // 3. Exactly 4 options with A-D
    if (!q.options || q.options.length !== 4) {
      allValid = false;
    } else {
      const labels = q.options.map((o) => o.label).join('');
      if (labels !== 'ABCD') {
        allValid = false;
      }
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        allValid = false;
      }
    }

    // 4. Diagram check
    const original = fetchedQuestions.find((f) => f.id === q.id);
    if (original?.image_url || original?.diagram?.image_url) {
      diagramCount++;
      const expectedUrl = resolveDiagramUrl(original.image_url || original.diagram?.image_url);
      if (q.imageUrl !== expectedUrl) {
        diagramValid = false;
      }
    }
  });

  recordResult(
    'All compiled questions have valid stem, 4 options (A-D), and exactly 1 correct answer',
    'Supabase Integration',
    allValid,
    `Checked ${compiled.length} compiled questions`
  );

  recordResult(
    'Questions with diagrams have imageUrl matching resolveDiagramUrl',
    'Supabase Integration',
    diagramCount > 0 && diagramValid,
    `Verified ${diagramCount} diagram question(s) in batch matching resolveDiagramUrl CDN resolution`
  );

  // Probe live HTTP fetch for diagram questions
  for (const q of compiled.filter((c) => c.imageUrl)) {
    try {
      const resp = await fetch(q.imageUrl!);
      const isOk = resp.status === 200 && (resp.headers.get('content-type') || '').includes('image');
      recordResult(
        `Live CDN Probe: Q${q.questionNumber} (${q.id})`,
        'Supabase CDN Probe',
        isOk,
        `Status ${resp.status}, Content-Type: ${resp.headers.get('content-type')}, URL: ${q.imageUrl}`
      );
    } catch (err: any) {
      recordResult(
        `Live CDN Probe: Q${q.questionNumber} (${q.id})`,
        'Supabase CDN Probe',
        false,
        `Fetch failed: ${err.message}`
      );
    }
  }
}

async function testAutoSelectQuestions() {
  console.log('\n--- 5. Testing autoSelectQuestions from Dynamic Pool ---');

  const pool: Question[] = Array.from({ length: 15 }, (_, i) => ({
    id: `dynamic-q-${i + 1}`,
    stem_markdown: `Sample question ${i + 1}`,
    options: [
      { id: 'opt-1', text_markdown: 'A' },
      { id: 'opt-2', text_markdown: 'B' },
      { id: 'opt-3', text_markdown: 'C' },
      { id: 'opt-4', text_markdown: 'D' },
    ],
    correct_option_id: 'opt-1',
    topic_id: i < 5 ? 'topic-micro' : i < 10 ? 'topic-macro' : 'topic-trade',
    has_diagram: false,
  }));

  // Test 1: sample count
  const selected5 = autoSelectQuestions({ count: 5, questionPool: pool });
  const countPass = selected5.length === 5 && new Set(selected5).size === 5;
  recordResult(
    'autoSelectQuestions selects requested count without duplicates',
    'Auto Select',
    countPass,
    `Selected ${selected5.length} distinct IDs: ${selected5.join(', ')}`
  );

  // Test 2: topic filtering
  const selectedMacro = autoSelectQuestions({
    count: 3,
    topicIds: ['topic-macro'],
    questionPool: pool,
  });
  const macroPass =
    selectedMacro.length === 3 &&
    selectedMacro.every((id) => {
      const item = pool.find((p) => p.id === id);
      return item?.topic_id === 'topic-macro';
    });
  recordResult(
    'autoSelectQuestions filters by topicIds correctly',
    'Auto Select',
    macroPass,
    `Selected ${selectedMacro.length} macro question IDs`
  );
}

async function main() {
  console.log('================================================================');
  console.log('       TEST COMPILER PRINTABLE TEMPLATE VERIFICATION            ');
  console.log('================================================================');

  await testDynamicPoolCompilation();
  await testCambridgeFallback();
  await testDraftSnapshotSerialization();
  await testSupabaseEndToEnd();
  await testAutoSelectQuestions();

  console.log('\n================================================================');
  console.log('                       AUDIT SUMMARY REPORT                     ');
  console.log('================================================================\n');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Checks Executed : ${total}`);
  console.log(`Passed Checks         : ${passed}`);
  console.log(`Failed Checks         : ${failed}`);
  console.log(`Success Rate          : ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('❌ FAILURES ENCOUNTERED:');
    results
      .filter((r) => !r.passed)
      .forEach((r, idx) => {
        console.log(`  ${idx + 1}. [${r.category}] ${r.name}: ${r.details}`);
      });
    console.log('\nVerification FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error in verification script:', err);
  process.exit(1);
});
