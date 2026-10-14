/**
 * Automated Verification Suite: Staged Paper Sync & Archive Operations
 *
 * Verifies:
 * 1. GET /api/ingest/staged-paper:
 *    - Validates returned `stagedPapers` include `is_published: boolean` and `lifecycle_state: string`.
 *    - Validates that papers present in Supabase `papers` table (such as 0455_s24_12)
 *      are accurately flagged with `is_published === true` and `lifecycle_state === 'published'`.
 *    - Validates single paper GET query parameter and directory traversal rejection.
 * 2. POST /api/ingest/staged-paper:
 *    - Temporary file creation in `staging/test_paper_temp.json`.
 *    - Archive action `{ action: 'archive', id: 'test_paper_temp' }`:
 *      verifies `staging/archive/test_paper_temp.json` exists and `staging/test_paper_temp.json` is removed.
 *    - Unarchive action `{ action: 'unarchive', id: 'test_paper_temp' }`:
 *      verifies file is restored to `staging/test_paper_temp.json` and removed from `staging/archive/`.
 *    - Directory traversal attack attempts (e.g. `../../etc/passwd`, `../secret`, `a/b`) are rejected with 400.
 *    - Invalid actions and malformed requests return 400.
 *    - Non-existent IDs return 404.
 *    - Guaranteed cleanup of all temporary test artifacts.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  GET,
  POST,
  fetchPersistentPaperStates,
  savePersistentPaperStates,
} from '../app/api/ingest/staged-paper/route';
import { supabase } from '../lib/supabaseClient';

// Test counters
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

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    pass(testName);
  } else {
    fail(testName, failureDetails || 'Assertion condition evaluated to false.');
  }
}

async function runVerification() {
  console.log('\n===============================================================');
  console.log('🧪 Staged Paper Supabase Sync & Archive QA Verification Suite');
  console.log('===============================================================\n');

  const stagingDir = path.resolve(process.cwd(), 'staging');
  const archiveDir = path.join(stagingDir, 'archive');
  const tempPaperId = 'test_paper_temp';
  const tempActiveFile = path.join(stagingDir, `${tempPaperId}.json`);
  const tempArchivedFile = path.join(archiveDir, `${tempPaperId}.json`);

  // Ensure staging directory exists
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  // Pre-cleanup in case previous run crashed
  if (fs.existsSync(tempActiveFile)) fs.unlinkSync(tempActiveFile);
  if (fs.existsSync(tempArchivedFile)) fs.unlinkSync(tempArchivedFile);

  try {
    // -------------------------------------------------------------
    // SECTION 1: GET /api/ingest/staged-paper - Metadata & Sync
    // -------------------------------------------------------------
    console.log('--- Section 1: GET /api/ingest/staged-paper Logic & Supabase Sync ---');

    // 1.1 List staged papers
    const listReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
    const listRes = await GET(listReq);
    assert(listRes.status === 200, 'GET /api/ingest/staged-paper returns HTTP 200');

    const listData = await listRes.json();
    assert(listData.success === true, 'GET response includes { success: true }');
    assert(Array.isArray(listData.papers), 'Response includes papers string array');
    assert(Array.isArray(listData.stagedPapers), 'Response includes stagedPapers array');
    assert(listData.stagedPapers.length > 0, 'stagedPapers array contains at least 1 staged paper');

    // 1.2 Validate schema of every stagedPaper item
    let allHavePublishedFlag = true;
    let allHaveLifecycleState = true;
    for (const paper of listData.stagedPapers) {
      if (typeof paper.is_published !== 'boolean') {
        allHavePublishedFlag = false;
      }
      if (typeof paper.lifecycle_state !== 'string' || !paper.lifecycle_state) {
        allHaveLifecycleState = false;
      }
    }
    assert(
      allHavePublishedFlag,
      'Every stagedPaper includes "is_published" as a boolean',
      'At least one staged paper was missing boolean is_published'
    );
    assert(
      allHaveLifecycleState,
      'Every stagedPaper includes "lifecycle_state" as a non-empty string',
      'At least one staged paper was missing string lifecycle_state'
    );

    // 1.3 Verify Supabase sync for known published paper 0455_s24_12
    const targetPaper = listData.stagedPapers.find((p: any) => p.id === '0455_s24_12');
    assert(Boolean(targetPaper), 'Found target paper "0455_s24_12" in staged papers list');

    if (targetPaper) {
      assert(
        targetPaper.is_published === true,
        '0455_s24_12 is_published === true (synced from Supabase papers table)',
        `Expected true, received ${targetPaper.is_published}`
      );
      assert(
        targetPaper.lifecycle_state === 'published',
        '0455_s24_12 lifecycle_state === "published"',
        `Expected "published", received "${targetPaper.lifecycle_state}"`
      );
      assert(
        typeof targetPaper.published_exam_paper_id === 'string' && targetPaper.published_exam_paper_id.length > 0,
        '0455_s24_12 includes non-empty published_exam_paper_id',
        `Received: ${targetPaper.published_exam_paper_id}`
      );

      // Verify directly against Supabase database for strict consistency
      const { data: dbPaper, error: dbErr } = await supabase
        .from('papers')
        .select('id, year, series, paper_code')
        .eq('year', 2024)
        .eq('series', 's')
        .eq('paper_code', '12')
        .single();

      assert(
        !dbErr && dbPaper?.id === targetPaper.published_exam_paper_id,
        'Supabase DB query confirms exam paper ID match',
        `DB Paper: ${JSON.stringify(dbPaper)}, Error: ${dbErr?.message}`
      );
    }

    // 1.4 Test single paper retrieval GET ?id=0455_s24_12
    const singleReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?id=0455_s24_12');
    const singleRes = await GET(singleReq);
    assert(singleRes.status === 200, 'GET /api/ingest/staged-paper?id=0455_s24_12 returns HTTP 200');

    const singleData = await singleRes.json();
    assert(singleData.success === true, 'Single paper GET returns { success: true }');
    assert(Boolean(singleData.paper), 'Single paper GET returns paper object');
    assert(singleData.is_published === true, 'Single paper GET returns is_published === true');
    assert(
      singleData.paper?.lifecycle_state === 'published',
      'Single paper GET sets paper.lifecycle_state === "published"'
    );

    // 1.5 Test GET directory traversal attacks are rejected with 400
    const traversalGetReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?id=../../etc/passwd');
    const traversalGetRes = await GET(traversalGetReq);
    assert(
      traversalGetRes.status === 400,
      'GET with directory traversal id="../../etc/passwd" rejected with HTTP 400',
      `Expected status 400, got ${traversalGetRes.status}`
    );

    // 1.6 Test GET non-existent paper returns 404
    const notFoundGetReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?id=non_existent_paper_9999');
    const notFoundGetRes = await GET(notFoundGetReq);
    assert(
      notFoundGetRes.status === 404,
      'GET non-existent paper ID returns HTTP 404',
      `Expected status 404, got ${notFoundGetRes.status}`
    );

    // -------------------------------------------------------------
    // SECTION 2: POST /api/ingest/staged-paper - Archive Actions & Security
    // -------------------------------------------------------------
    console.log('\n--- Section 2: POST /api/ingest/staged-paper Archive Actions & Security ---');

    // 2.1 Create temporary staging paper
    const tempPaperContent = {
      id: tempPaperId,
      lifecycle_state: 'draft',
      subject: { code: '0455', name: 'Economics', icon: 'trending-up' },
      paper: { series: 's', paper_code: '99', year: 2029 },
      syllabus_topics: [{ name: 'Test Topic', order_index: 1 }],
      questions: [
        {
          question_number: 1,
          cambridge_source_ref: '0455/99/S/29 Q1',
          topic_name: 'Test Topic',
          stem_markdown: 'What is a temporary verification question?',
          options: [
            { label: 'A', content_markdown: 'Option A', is_correct: true },
            { label: 'B', content_markdown: 'Option B', is_correct: false },
            { label: 'C', content_markdown: 'Option C', is_correct: false },
            { label: 'D', content_markdown: 'Option D', is_correct: false },
          ],
          explanation_markdown: 'Test explanation',
          status: 'active',
        },
      ],
    };

    fs.writeFileSync(tempActiveFile, JSON.stringify(tempPaperContent, null, 2), 'utf8');
    assert(fs.existsSync(tempActiveFile), `Created temporary test file at staging/${tempPaperId}.json`);

    // 2.2 Call archive action: { action: 'archive', id: 'test_paper_temp' }
    const archiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', id: tempPaperId }),
    });
    const archiveRes = await POST(archiveReq);
    assert(archiveRes.status === 200, 'POST { action: "archive" } returns HTTP 200');

    const archiveData = await archiveRes.json();
    assert(archiveData.success === true, 'Archive response returns { success: true }');
    assert(fs.existsSync(tempArchivedFile), 'staging/archive/test_paper_temp.json exists after archive');
    assert(!fs.existsSync(tempActiveFile), 'staging/test_paper_temp.json is removed from active staging');

    // 2.3 Verify GET list behavior with archived file
    const activeListReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
    const activeListRes = await GET(activeListReq);
    const activeListData = await activeListRes.json();
    const foundInActive = activeListData.stagedPapers.some((p: any) => p.id === tempPaperId);
    assert(!foundInActive, 'Active GET listing excludes archived paper test_paper_temp');

    const fullListReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?include_archived=true');
    const fullListRes = await GET(fullListReq);
    const fullListData = await fullListRes.json();
    const foundInArchived = fullListData.stagedPapers.find((p: any) => p.id === tempPaperId);
    assert(
      Boolean(foundInArchived) && foundInArchived.is_archived === true,
      'GET listing with ?include_archived=true includes test_paper_temp with is_archived === true'
    );

    // 2.4 Call unarchive action: { action: 'unarchive', id: 'test_paper_temp' }
    const unarchiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unarchive', id: tempPaperId }),
    });
    const unarchiveRes = await POST(unarchiveReq);
    assert(unarchiveRes.status === 200, 'POST { action: "unarchive" } returns HTTP 200');

    const unarchiveData = await unarchiveRes.json();
    assert(unarchiveData.success === true, 'Unarchive response returns { success: true }');
    assert(fs.existsSync(tempActiveFile), 'staging/test_paper_temp.json is restored after unarchive');
    assert(!fs.existsSync(tempArchivedFile), 'staging/archive/test_paper_temp.json is removed after unarchive');

    // 2.5 Security: Directory Traversal Attacks on POST must be rejected with HTTP 400
    const maliciousPayloads = [
      { action: 'archive', id: '../../etc/passwd' },
      { action: 'archive', id: '../secret' },
      { action: 'archive', id: 'foo/bar' },
      { action: 'archive', id: '..\\win.ini' },
      { action: 'unarchive', id: '../../etc/passwd' },
      { action: 'unarchive', id: '../staging/test' },
      { action: 'unarchive', id: '/etc/shadow' },
    ];

    for (const payload of maliciousPayloads) {
      const traversalReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const traversalRes = await POST(traversalReq);
      assert(
        traversalRes.status === 400,
        `POST ${JSON.stringify(payload)} rejected with HTTP 400`,
        `Expected status 400, received ${traversalRes.status}`
      );
    }

    // 2.6 Reject invalid action or malformed request
    const invalidActionReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'format_disk', id: tempPaperId }),
    });
    const invalidActionRes = await POST(invalidActionReq);
    assert(
      invalidActionRes.status === 400,
      'POST with invalid action rejected with HTTP 400',
      `Expected status 400, received ${invalidActionRes.status}`
    );

    const missingIdReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    });
    const missingIdRes = await POST(missingIdReq);
    assert(
      missingIdRes.status === 400,
      'POST with missing id rejected with HTTP 400',
      `Expected status 400, received ${missingIdRes.status}`
    );

    // 2.7 Archiving a non-existent paper returns HTTP 404
    const notFoundArchiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive', id: 'non_existent_paper_88888' }),
    });
    const notFoundArchiveRes = await POST(notFoundArchiveReq);
    assert(
      notFoundArchiveRes.status === 404,
      'POST archive on non-existent paper returns HTTP 404',
      `Expected status 404, received ${notFoundArchiveRes.status}`
    );

    // -------------------------------------------------------------
    // SECTION 3: Serverless Read-Only Filesystem Simulation & Supabase Storage Persistence
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Read-Only Filesystem Simulation & Supabase Storage Persistence ---');

    const readOnlyPaperId = 'test_readonly_sim';
    const readOnlyActiveFile = path.join(stagingDir, `${readOnlyPaperId}.json`);
    const readOnlySampleData = {
      id: readOnlyPaperId,
      lifecycle_state: 'draft',
      subject: { code: '0455', name: 'Economics', icon: 'trending-up' },
      paper: { series: 's', paper_code: '99', year: 2029 },
      syllabus_topics: [{ name: 'Test Topic', order_index: 1 }],
      questions: [
        {
          question_number: 1,
          cambridge_source_ref: '0455/99/S/29 Q1',
          topic_name: 'Test Topic',
          stem_markdown: 'What is opportunity cost under read-only simulation?',
          options: [
            { label: 'A', content_markdown: 'Option A', is_correct: true },
            { label: 'B', content_markdown: 'Option B', is_correct: false },
            { label: 'C', content_markdown: 'Option C', is_correct: false },
            { label: 'D', content_markdown: 'Option D', is_correct: false },
          ],
          explanation_markdown: 'Test explanation for read-only simulation',
          status: 'active',
        },
      ],
    };

    // 3.1 Write initial test file locally
    fs.writeFileSync(readOnlyActiveFile, JSON.stringify(readOnlySampleData, null, 2), 'utf8');
    assert(fs.existsSync(readOnlyActiveFile), 'Created test_readonly_sim.json');

    // 3.2 Mock fs.mkdirSync and fs.renameSync to simulate Vercel read-only filesystem (/var/task)
    const origMkdirSync = fs.mkdirSync;
    const origRenameSync = fs.renameSync;
    const roSimulation = { errorThrown: false };

    // Simulate error: ENOENT: no such file or directory, mkdir '/var/task/staging/archive'
    fs.mkdirSync = ((dirPath: any, options: any) => {
      roSimulation.errorThrown = true;
      const err = new Error("ENOENT: no such file or directory, mkdir '/var/task/staging/archive'");
      (err as any).code = 'ENOENT';
      throw err;
    }) as any;

    fs.renameSync = ((oldPath: any, newPath: any) => {
      roSimulation.errorThrown = true;
      const err = new Error("EROFS: read-only file system, rename");
      (err as any).code = 'EROFS';
      throw err;
    }) as any;

    try {
      // Call archive on test_readonly_sim
      const roArchiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', id: readOnlyPaperId }),
      });
      const roArchiveRes = await POST(roArchiveReq);

      assert(roArchiveRes.status === 200, 'POST archive under read-only filesystem returns HTTP 200 (not 500 ENOENT)');
      const roArchiveData = await roArchiveRes.json();
      assert(roArchiveData.success === true, 'Archive response returns success: true under read-only error');
      assert(roSimulation.errorThrown === true, 'Verified that read-only filesystem error was thrown and caught cleanly');

      // Verify persistent state in Supabase Storage
      const statesAfterArchive = await fetchPersistentPaperStates();
      assert(
        statesAfterArchive.archived.includes(readOnlyPaperId),
        'Paper is recorded in Supabase Storage paper_states.archived'
      );

      // Verify GET listing with include_archived=false excludes it
      const roListReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
      const roListRes = await GET(roListReq);
      const roListData = await roListRes.json();
      const inDefaultList = roListData.stagedPapers.some((p: any) => p.id === readOnlyPaperId);
      assert(!inDefaultList, 'Default GET list excludes read-only archived paper');

      // Verify GET listing with include_archived=true includes it with is_archived: true
      const roListArchivedReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?include_archived=true');
      const roListArchivedRes = await GET(roListArchivedReq);
      const roListArchivedData = await roListArchivedRes.json();
      const archivedItem = roListArchivedData.stagedPapers.find((p: any) => p.id === readOnlyPaperId);
      assert(Boolean(archivedItem), 'GET with ?include_archived=true finds the archived paper');
      assert(archivedItem?.is_archived === true, 'Archived paper has is_archived === true in summary');

      // Verify single paper GET returns is_archived === true
      const roSingleReq = new NextRequest(`http://localhost:3000/api/ingest/staged-paper?id=${readOnlyPaperId}`);
      const roSingleRes = await GET(roSingleReq);
      assert(roSingleRes.status === 200, 'Single paper GET returns HTTP 200');
      const roSingleData = await roSingleRes.json();
      assert(roSingleData.is_archived === true, 'Single paper GET returns is_archived === true');

      // Call unarchive on test_readonly_sim (still with read-only simulation)
      const roUnarchiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive', id: readOnlyPaperId }),
      });
      const roUnarchiveRes = await POST(roUnarchiveReq);
      assert(roUnarchiveRes.status === 200, 'POST unarchive under read-only filesystem returns HTTP 200');
      const roUnarchiveData = await roUnarchiveRes.json();
      assert(roUnarchiveData.success === true, 'Unarchive response returns success: true under read-only error');

      // Verify persistent state in Supabase Storage has removed it
      const statesAfterUnarchive = await fetchPersistentPaperStates();
      assert(
        !statesAfterUnarchive.archived.includes(readOnlyPaperId),
        'Paper is removed from Supabase Storage paper_states.archived'
      );

      // Verify default GET listing now includes it again
      const roListRestoredReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
      const roListRestoredRes = await GET(roListRestoredReq);
      const roListRestoredData = await roListRestoredRes.json();
      const restoredItem = roListRestoredData.stagedPapers.find((p: any) => p.id === readOnlyPaperId);
      assert(Boolean(restoredItem), 'Restored paper now appears in default GET list');
      assert(restoredItem?.is_archived === false, 'Restored paper has is_archived === false');

      // 3.3 Test Direct Save under read-only filesystem (fallback to Supabase Storage staged_papers/)
      const origWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = ((_filePath: any, _content: any, _options: any) => {
        const err = new Error("EROFS: read-only file system, write");
        (err as any).code = 'EROFS';
        throw err;
      }) as any;

      const remoteSavePaperId = 'test_readonly_remote_save';
      const remoteSavePaperData = {
        ...readOnlySampleData,
        id: remoteSavePaperId,
      };

      try {
        const saveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paper: remoteSavePaperData, id: remoteSavePaperId }),
        });
        const saveRes = await POST(saveReq);
        assert(
          saveRes.status === 200,
          'Direct save under read-only filesystem falls back to Supabase Storage with HTTP 200'
        );
        const saveData = await saveRes.json();
        assert(saveData.success === true, 'Direct save response has success === true');

        // Verify that GET finds the paper saved in Supabase Storage
        const getRemoteReq = new NextRequest(`http://localhost:3000/api/ingest/staged-paper?id=${remoteSavePaperId}`);
        const getRemoteRes = await GET(getRemoteReq);
        assert(getRemoteRes.status === 200, 'GET can retrieve paper saved in Supabase Storage');
        const getRemoteData = await getRemoteRes.json();
        assert(getRemoteData.paper?.id === remoteSavePaperId, 'Retrieved paper matches remote saved id');
      } finally {
        fs.writeFileSync = origWriteFileSync;
        try {
          await supabase.storage.from('question-diagrams').remove([`staged_papers/${remoteSavePaperId}.json`]);
        } catch {
          // ignore
        }
      }
    } finally {
      // Restore original fs functions
      fs.mkdirSync = origMkdirSync;
      fs.renameSync = origRenameSync;

      // Clean up read-only local file
      if (fs.existsSync(readOnlyActiveFile)) {
        fs.unlinkSync(readOnlyActiveFile);
        console.log(`🧹 Cleaned up temporary read-only test file: ${readOnlyActiveFile}`);
      }

      // Ensure Supabase Storage paper_states does not leave test residues
      try {
        const cleanStates = await fetchPersistentPaperStates();
        cleanStates.archived = cleanStates.archived.filter((id) => id !== readOnlyPaperId && id !== tempPaperId);
        cleanStates.deleted = cleanStates.deleted.filter((id) => id !== readOnlyPaperId && id !== tempPaperId);
        await savePersistentPaperStates(cleanStates);
      } catch (err: any) {
        console.warn('Could not clean test ids from Supabase storage states:', err?.message);
      }
    }
  } finally {
    // -------------------------------------------------------------
    // Cleanup temporary files
    // -------------------------------------------------------------
    if (fs.existsSync(tempActiveFile)) {
      fs.unlinkSync(tempActiveFile);
      console.log(`\n🧹 Cleaned up temporary active file: ${tempActiveFile}`);
    }
    if (fs.existsSync(tempArchivedFile)) {
      fs.unlinkSync(tempArchivedFile);
      console.log(`🧹 Cleaned up temporary archive file: ${tempArchivedFile}`);
    }
  }

  // Final summary
  console.log('\n===============================================================');
  console.log(`📊 Test Summary: ${passedTests} / ${totalTests} passed (${failedTests} failures)`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    console.error(`❌ Verification suite failed with ${failedTests} failure(s).`);
    process.exit(1);
  } else {
    console.log('✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }
}

runVerification().catch((err) => {
  console.error('Unhandled exception during verification:', err);
  process.exit(1);
});
