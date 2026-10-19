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
  listTestDrafts,
  deleteTestDraft,
  duplicateTestDraft,
  renameTestDraft,
  savePrintSnapshot,
  exportTestDraftJson,
  importTestDraftJson,
  sanitizeAccountScope,
  resolveCurrentAccountScope,
  getDraftStorageKey,
  DRAFT_KEY_PREFIX,
  PRINT_SNAPSHOT_PREFIX,
  DRAFT_CHANGE_EVENT,
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

async function testDraftLifecycleOperations() {
  console.log('\n--- 3b. Testing Draft Lifecycle Operations (CRUD, Duplication, Export/Import, Print Snapshot) ---');

  const draftId = `lifecycle-draft-${Date.now()}`;
  const initialCreated = '2026-01-01T10:00:00.000Z';
  const initialConfig: TestPaperConfig = {
    id: draftId,
    title: '', // explicitly empty to test auto-formatting default title
    subjectCode: '0455',
    subjectName: 'Economics',
    schoolName: 'Frontier Academy',
    durationMinutes: 45,
    totalMarks: 0,
    testCode: 'LC-01',
    dateString: 'October 2026',
    includeCoverPage: true,
    includeCandidateHeader: true,
    includeBubbleSheet: false,
    includeMarkScheme: false,
    questionIds: ['uuid-sample-1', 'uuid-sample-2'],
    createdAt: initialCreated,
  };

  // 1. saveTestDraft auto-fills default non-empty title, populates updatedAt and topicSummary
  const saved = saveTestDraft(initialConfig);
  const reloadedSaved = loadTestDraft(draftId);
  const autoTitlePass =
    reloadedSaved !== null &&
    reloadedSaved.title.length > 0 &&
    reloadedSaved.title.includes('0455') &&
    reloadedSaved.title.includes('Draft') &&
    typeof reloadedSaved.updatedAt === 'string' &&
    Array.isArray(reloadedSaved.topicSummary) &&
    reloadedSaved.topicSummary.length > 0;

  recordResult(
    'saveTestDraft auto-fills title, populates updatedAt and topicSummary',
    'Draft Lifecycle',
    Boolean(autoTitlePass),
    autoTitlePass
      ? `Auto title: "${reloadedSaved?.title}", updatedAt: ${reloadedSaved?.updatedAt}, topics: ${reloadedSaved?.topicSummary?.join(', ')}`
      : 'Failed to auto-format default title or populate updatedAt/topicSummary'
  );

  // 2. renameTestDraft updates title and notes in-place while preserving id and createdAt
  const renamed = renameTestDraft(draftId, 'Renamed Macro Test Paper', 'Focus on aggregate demand notes');
  const reloadedRenamed = loadTestDraft(draftId);
  const renamePass =
    renamed !== null &&
    reloadedRenamed !== null &&
    reloadedRenamed.id === draftId &&
    reloadedRenamed.title === 'Renamed Macro Test Paper' &&
    reloadedRenamed.notes === 'Focus on aggregate demand notes' &&
    reloadedRenamed.createdAt === initialCreated;

  recordResult(
    'renameTestDraft updates title and notes in-place while preserving id and createdAt',
    'Draft Lifecycle',
    Boolean(renamePass),
    renamePass
      ? `Successfully updated title to "${reloadedRenamed?.title}" with notes, keeping createdAt=${reloadedRenamed?.createdAt}`
      : `Failed to rename draft or preserve createdAt (got title="${reloadedRenamed?.title}", createdAt="${reloadedRenamed?.createdAt}")`
  );

  // 3. duplicateTestDraft creates a new draft ID with (Copy) suffix and identical questionIds
  const duplicated = duplicateTestDraft(draftId);
  const duplicatePass =
    duplicated !== null &&
    duplicated.id !== draftId &&
    duplicated.title.endsWith('(Copy)') &&
    JSON.stringify(duplicated.questionIds) === JSON.stringify(reloadedRenamed?.questionIds);

  recordResult(
    'duplicateTestDraft creates new ID with (Copy) suffix and identical questionIds',
    'Draft Lifecycle',
    Boolean(duplicatePass),
    duplicatePass
      ? `Created copy ID: ${duplicated?.id}, title: "${duplicated?.title}", questions: ${duplicated?.questionIds.length}`
      : 'Failed to duplicate draft correctly'
  );

  // 4. savePrintSnapshot can be loaded by loadTestDraft(id), but does NOT pollute listTestDrafts()
  const snapshotId = `print-snapshot-${Date.now()}`;
  const snapshotConfig: TestPaperConfig = {
    id: snapshotId,
    title: 'Print Preview Snapshot Only',
    subjectCode: '0455',
    subjectName: 'Economics',
    schoolName: 'Frontier Academy',
    durationMinutes: 45,
    totalMarks: 2,
    testCode: 'PRINT-01',
    dateString: 'October 2026',
    includeCoverPage: true,
    includeCandidateHeader: true,
    includeBubbleSheet: true,
    includeMarkScheme: true,
    questionIds: ['uuid-sample-1', 'uuid-sample-2'],
    createdAt: new Date().toISOString(),
  };

  savePrintSnapshot(snapshotConfig);
  const loadedSnapshot = loadTestDraft(snapshotId);
  const draftsList = listTestDrafts();
  const snapshotInDraftsList = draftsList.some((d) => d.id === snapshotId);
  const printSnapshotPass = loadedSnapshot !== null && !snapshotInDraftsList;

  recordResult(
    'savePrintSnapshot loadable via loadTestDraft without polluting listTestDrafts',
    'Draft Lifecycle',
    Boolean(printSnapshotPass),
    printSnapshotPass
      ? `Print snapshot loaded successfully (title: "${loadedSnapshot?.title}") and listTestDrafts() count=${draftsList.length} (snapshot excluded)`
      : `Snapshot leaking into drafts or failed to load (loaded: ${Boolean(loadedSnapshot)}, leaked: ${snapshotInDraftsList})`
  );

  // 5. exportTestDraftJson and importTestDraftJson round-trip a draft cleanly
  const exportedJson = exportTestDraftJson(reloadedRenamed!);
  const roundtripImported = importTestDraftJson(exportedJson);
  const roundtripPass =
    roundtripImported !== null &&
    roundtripImported.id === draftId &&
    roundtripImported.title === reloadedRenamed?.title &&
    roundtripImported.questionIds.length === reloadedRenamed?.questionIds.length;

  recordResult(
    'exportTestDraftJson and importTestDraftJson round-trip draft cleanly',
    'Draft Lifecycle',
    Boolean(roundtripPass),
    roundtripPass
      ? `Round-trip successful: exported ${exportedJson.length} chars, imported draft ID ${roundtripImported?.id} ("${roundtripImported?.title}")`
      : 'Failed round-trip JSON export/import'
  );

  // 6. deleteTestDraft removes draft from listTestDrafts()
  const deleteSuccess = deleteTestDraft(draftId);
  const reloadedAfterDelete = loadTestDraft(draftId);
  const draftsAfterDelete = listTestDrafts();
  const deletedInList = draftsAfterDelete.some((d) => d.id === draftId);
  const deletePass = deleteSuccess && reloadedAfterDelete === null && !deletedInList;

  // Clean up duplicated draft as well
  if (duplicated) {
    deleteTestDraft(duplicated.id);
  }

  recordResult(
    'deleteTestDraft removes draft from storage and listTestDrafts',
    'Draft Lifecycle',
    Boolean(deletePass),
    deletePass
      ? `Draft ${draftId} successfully deleted; drafts remaining: ${draftsAfterDelete.length}`
      : 'Failed to delete draft from storage'
  );
}

async function testAccountScopedDraftIsolation() {
  console.log('\n--- 3c. Testing Account-Scoped Draft Isolation (Multi-Tenant Local Storage) ---');

  const aliceId = 'teacher-alice-001';
  const bobId = 'teacher-bob-002';
  const sharedDraftId = 'shared-id-1';

  const aliceDraft: TestPaperConfig = {
    id: sharedDraftId,
    title: "Alice's Economics Exam",
    subjectCode: '0455',
    subjectName: 'Economics',
    schoolName: "Alice's Grammar School",
    durationMinutes: 60,
    totalMarks: 2,
    testCode: 'ALICE-01',
    dateString: 'October 2026',
    includeCoverPage: true,
    includeCandidateHeader: true,
    includeBubbleSheet: true,
    includeMarkScheme: false,
    notes: 'Alice private test notes',
    questionIds: ['uuid-sample-1', 'uuid-sample-2'],
    createdAt: '2026-02-01T08:00:00.000Z',
  };

  const bobDraft: TestPaperConfig = {
    id: sharedDraftId,
    title: "Bob's Chemistry Quiz",
    subjectCode: '0620',
    subjectName: 'Chemistry',
    schoolName: "Bob's Collegiate",
    durationMinutes: 30,
    totalMarks: 1,
    testCode: 'BOB-01',
    dateString: 'October 2026',
    includeCoverPage: false,
    includeCandidateHeader: true,
    includeBubbleSheet: false,
    includeMarkScheme: true,
    notes: 'Bob private chemistry notes',
    questionIds: ['uuid-sample-1'],
    createdAt: '2026-03-01T09:00:00.000Z',
  };

  // 1. Save drafts under Alice and Bob accounts with the exact same ID
  saveTestDraft(aliceDraft, aliceId);
  saveTestDraft(bobDraft, bobId);

  // Check 1: listTestDrafts(accountId) isolation
  const aliceDrafts = listTestDrafts(aliceId);
  const bobDrafts = listTestDrafts(bobId);

  const isolationPass =
    aliceDrafts.some((d) => d.id === sharedDraftId && d.title === "Alice's Economics Exam") &&
    !aliceDrafts.some((d) => d.title === "Bob's Chemistry Quiz") &&
    bobDrafts.some((d) => d.id === sharedDraftId && d.title === "Bob's Chemistry Quiz") &&
    !bobDrafts.some((d) => d.title === "Alice's Economics Exam");

  recordResult(
    'listTestDrafts(accountId) isolates drafts strictly between accounts',
    'Account Isolation',
    Boolean(isolationPass),
    isolationPass
      ? `Alice sees ${aliceDrafts.length} draft(s) (only Alice's), Bob sees ${bobDrafts.length} draft(s) (only Bob's)`
      : `Cross-account draft leakage detected (Alice count: ${aliceDrafts.length}, Bob count: ${bobDrafts.length})`
  );

  // Check 2: Same ID collision avoidance in localStorage
  const loadedAlice = loadTestDraft(sharedDraftId, aliceId);
  const loadedBob = loadTestDraft(sharedDraftId, bobId);

  const collisionPass =
    loadedAlice !== null &&
    loadedBob !== null &&
    loadedAlice.id === sharedDraftId &&
    loadedBob.id === sharedDraftId &&
    loadedAlice.title === "Alice's Economics Exam" &&
    loadedBob.title === "Bob's Chemistry Quiz" &&
    loadedAlice.ownerId === aliceId &&
    loadedBob.ownerId === bobId &&
    loadedAlice.notes === 'Alice private test notes' &&
    loadedBob.notes === 'Bob private chemistry notes';

  recordResult(
    'Identical draft IDs do not overwrite across different accounts',
    'Account Isolation',
    Boolean(collisionPass),
    collisionPass
      ? `Alice: "${loadedAlice?.title}" (${loadedAlice?.ownerId}), Bob: "${loadedBob?.title}" (${loadedBob?.ownerId})`
      : 'Draft collision detected between Alice and Bob'
  );

  // Check 3: Renaming and deleting in Alice does not affect Bob
  renameTestDraft(sharedDraftId, "Alice's Updated Economics Exam", 'Updated notes for Alice', aliceId);
  const reloadedBobAfterAliceRename = loadTestDraft(sharedDraftId, bobId);
  const bobUnaffectedByRename =
    reloadedBobAfterAliceRename !== null &&
    reloadedBobAfterAliceRename.title === "Bob's Chemistry Quiz" &&
    reloadedBobAfterAliceRename.notes === 'Bob private chemistry notes';

  deleteTestDraft(sharedDraftId, aliceId);
  const reloadedAliceAfterDelete = loadTestDraft(sharedDraftId, aliceId);
  const reloadedBobAfterAliceDelete = loadTestDraft(sharedDraftId, bobId);

  const deleteIsolationPass =
    reloadedAliceAfterDelete === null &&
    bobUnaffectedByRename &&
    reloadedBobAfterAliceDelete !== null &&
    reloadedBobAfterAliceDelete.title === "Bob's Chemistry Quiz";

  recordResult(
    'Deleting or renaming draft in Account A has zero effect on Account B',
    'Account Isolation',
    Boolean(deleteIsolationPass),
    deleteIsolationPass
      ? `Alice draft deleted successfully; Bob draft persists intact ("${reloadedBobAfterAliceDelete?.title}")`
      : 'Cross-account side effect detected upon rename/delete'
  );

  // Check 4: Exporting from Alice and importing into Bob reassigns ownerId to Bob
  const freshAliceDraftId = `alice-export-${Date.now()}`;
  const freshAliceDraft: TestPaperConfig = {
    id: freshAliceDraftId,
    title: 'Alice Shared Master Paper',
    subjectCode: '0455',
    subjectName: 'Economics',
    schoolName: 'Alice Academy',
    durationMinutes: 45,
    totalMarks: 2,
    testCode: 'ALICE-EXP-01',
    dateString: 'October 2026',
    includeCoverPage: true,
    includeCandidateHeader: true,
    includeBubbleSheet: false,
    includeMarkScheme: true,
    questionIds: ['uuid-sample-1', 'uuid-sample-2'],
    createdAt: new Date().toISOString(),
  };

  const savedAliceDraft = saveTestDraft(freshAliceDraft, aliceId);
  const exportedJsonFromAlice = exportTestDraftJson(savedAliceDraft);

  // Bob imports Alice's JSON
  const importedIntoBob = importTestDraftJson(exportedJsonFromAlice, bobId);
  const bobDraftsAfterImport = listTestDrafts(bobId);
  const aliceDraftsAfterImport = listTestDrafts(aliceId);

  const importReassignPass =
    importedIntoBob !== null &&
    importedIntoBob.ownerId === bobId &&
    bobDraftsAfterImport.some((d) => d.id === importedIntoBob.id && d.ownerId === bobId) &&
    !aliceDraftsAfterImport.some((d) => d.id === importedIntoBob.id && d.ownerId === bobId);

  recordResult(
    'importTestDraftJson overrides ownerId to current account scope',
    'Account Isolation',
    Boolean(importReassignPass),
    importReassignPass
      ? `Imported draft ID ${importedIntoBob?.id} owned by "${importedIntoBob?.ownerId}" in Bob's draft list`
      : 'Failed to reassign ownerId to importing account'
  );

  // Clean up Bob's remaining drafts
  deleteTestDraft(sharedDraftId, bobId);
  deleteTestDraft(importedIntoBob.id, bobId);
  deleteTestDraft(freshAliceDraftId, aliceId);
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
  await testDraftLifecycleOperations();
  await testAccountScopedDraftIsolation();
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
