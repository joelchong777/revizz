/**
 * Automated Verification Suite: Delete Staged and Archived Papers
 *
 * Verifies:
 * 1. Case 1: Delete Active Staged Paper
 *    - Creation of dummy test paper `staging/dummy_test_delete_active.json`.
 *    - Deletion via POST { action: "delete", id } and DELETE ?id=...
 *    - Unlinking of local file.
 *    - Persistent state recording in `deleted` and exclusion from `archived`.
 * 2. Case 2: Delete Archived Paper
 *    - Creation of dummy test paper `staging/archive/dummy_test_delete_archived.json`.
 *    - Paper marked as archived in persistent states.
 *    - Deletion via DELETE handler.
 *    - Unlinking of local archive file.
 *    - Persistent state updated: ID recorded in `deleted` and pruned from `archived`.
 * 3. Case 3: Directory Traversal Rejection
 *    - Malicious IDs (e.g. `../forbidden`, `../../test`, `foo/bar`, `..\\win`) passed to POST and DELETE.
 *    - Rejection with HTTP 400 and directory traversal / invalid ID error message.
 * 4. Case 4: Non-existent Paper Handling
 *    - Deleting non-existent paper ID returns HTTP 404.
 *    - Deleting an already-deleted paper returns HTTP 404.
 * 5. Case 5: Listing Exclusion
 *    - GET /api/ingest/staged-paper excludes deleted papers from active listing.
 *    - GET /api/ingest/staged-paper?include_archived=true excludes deleted papers.
 *    - Single paper GET ?id=... on deleted paper returns HTTP 404.
 *    - Even if local orphan file exists on disk, deletedSet excludes it from listings.
 * 6. Guaranteed Cleanup of temporary files and remote persistent states.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../app/api/ingest/staged-paper/route';
import {
  fetchPersistentPaperStates,
  savePersistentPaperStates,
} from '../lib/ingestion/stagedPaperStorage';

// Test counters and reporting
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

function createDummyPaper(id: string, isArchived: boolean = false) {
  return {
    id,
    lifecycle_state: isArchived ? 'archived' : 'draft',
    subject: { code: '0455', name: 'Economics', icon: 'trending-up' },
    paper: { series: 's', paper_code: '99', year: 2029 },
    syllabus_topics: [{ name: 'Test Topic', order_index: 1 }],
    questions: [
      {
        question_number: 1,
        cambridge_source_ref: '0455/99/S/29 Q1',
        topic_name: 'Test Topic',
        stem_markdown: `Dummy verification question for ${id}`,
        options: [
          { label: 'A', content_markdown: 'Option A', is_correct: true },
          { label: 'B', content_markdown: 'Option B', is_correct: false },
          { label: 'C', content_markdown: 'Option C', is_correct: false },
          { label: 'D', content_markdown: 'Option D', is_correct: false },
        ],
        explanation_markdown: 'Dummy explanation',
        status: 'active',
      },
    ],
  };
}

async function runVerification() {
  console.log('\n===============================================================');
  console.log('🧪 Staged Paper Deletion QA Verification Suite');
  console.log('===============================================================\n');

  const stagingDir = path.resolve(process.cwd(), 'staging');
  const archiveDir = path.join(stagingDir, 'archive');

  const activePaperId = 'dummy_test_delete_active';
  const archivedPaperId = 'dummy_test_delete_archived';
  const restActivePaperId = 'dummy_test_delete_rest_active';

  const activeFilePath = path.join(stagingDir, `${activePaperId}.json`);
  const archivedFilePath = path.join(archiveDir, `${archivedPaperId}.json`);
  const restActiveFilePath = path.join(stagingDir, `${restActivePaperId}.json`);

  const allTestIds = [activePaperId, archivedPaperId, restActivePaperId];

  // Ensure directories exist
  if (!fs.existsSync(stagingDir)) fs.mkdirSync(stagingDir, { recursive: true });
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  // Initial cleanup of disk files
  for (const file of [activeFilePath, archivedFilePath, restActiveFilePath]) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }

  // Initial cleanup of persistent states in case previous run left them
  console.log('--- Phase 0: Initializing Clean Persistent State ---');
  try {
    const initialStates = await fetchPersistentPaperStates();
    const cleanDeleted = initialStates.deleted.filter((id) => !allTestIds.includes(id));
    const cleanArchived = initialStates.archived.filter((id) => !allTestIds.includes(id));
    await savePersistentPaperStates({ archived: cleanArchived, deleted: cleanDeleted });
    pass('Persistent storage sanitized of prior test artifacts');
  } catch (err: any) {
    fail('Persistent storage sanitization', err?.message);
  }

  try {
    // -------------------------------------------------------------
    // CASE 1: Delete Active Staged Paper
    // -------------------------------------------------------------
    console.log('\n--- Case 1: Delete Active Staged Paper ---');

    // 1.1 Create dummy active paper
    fs.writeFileSync(activeFilePath, JSON.stringify(createDummyPaper(activePaperId), null, 2), 'utf8');
    assert(fs.existsSync(activeFilePath), `Created dummy active paper at staging/${activePaperId}.json`);

    // Verify paper appears in GET list initially
    const preCheckReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
    const preCheckRes = await GET(preCheckReq);
    const preCheckData = await preCheckRes.json();
    assert(
      preCheckData.stagedPapers.some((p: any) => p.id === activePaperId),
      `Paper "${activePaperId}" is present in staging listing before deletion`
    );

    // 1.2 Call POST { action: 'delete', id: activePaperId }
    const deleteActiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: activePaperId }),
    });
    const deleteActiveRes = await POST(deleteActiveReq);
    assert(deleteActiveRes.status === 200, 'POST { action: "delete" } returns HTTP 200');

    const deleteActiveData = await deleteActiveRes.json();
    assert(deleteActiveData.success === true, 'Response body has { success: true }');
    assert(deleteActiveData.action === 'delete', 'Response body has action === "delete"');
    assert(deleteActiveData.id === activePaperId, `Response body contains deleted id "${activePaperId}"`);

    // 1.3 Assert local file is unlinked
    assert(!fs.existsSync(activeFilePath), `Local file staging/${activePaperId}.json was unlinked`);

    // 1.4 Assert persistent states record paper in deleted and NOT in archived
    const statesAfterActiveDelete = await fetchPersistentPaperStates();
    assert(
      statesAfterActiveDelete.deleted.includes(activePaperId),
      `fetchPersistentPaperStates() records "${activePaperId}" in "deleted"`
    );
    assert(
      !statesAfterActiveDelete.archived.includes(activePaperId),
      `fetchPersistentPaperStates() does NOT record "${activePaperId}" in "archived"`
    );

    // 1.5 Also test DELETE HTTP method handler with REST endpoint on another active dummy paper
    fs.writeFileSync(restActiveFilePath, JSON.stringify(createDummyPaper(restActivePaperId), null, 2), 'utf8');
    assert(fs.existsSync(restActiveFilePath), `Created dummy REST active paper at staging/${restActivePaperId}.json`);

    const deleteRestReq = new NextRequest(`http://localhost:3000/api/ingest/staged-paper?id=${restActivePaperId}`, {
      method: 'DELETE',
    });
    const deleteRestRes = await DELETE(deleteRestReq);
    assert(deleteRestRes.status === 200, 'DELETE ?id=... returns HTTP 200');

    const deleteRestData = await deleteRestRes.json();
    assert(deleteRestData.success === true, 'DELETE response body has { success: true }');
    assert(!fs.existsSync(restActiveFilePath), `Local file staging/${restActivePaperId}.json was unlinked by DELETE`);

    const statesAfterRestDelete = await fetchPersistentPaperStates();
    assert(
      statesAfterRestDelete.deleted.includes(restActivePaperId),
      `fetchPersistentPaperStates() records "${restActivePaperId}" in "deleted" via DELETE`
    );

    // -------------------------------------------------------------
    // CASE 2: Delete Archived Paper
    // -------------------------------------------------------------
    console.log('\n--- Case 2: Delete Archived Paper ---');

    // 2.1 Create dummy archived paper
    fs.writeFileSync(archivedFilePath, JSON.stringify(createDummyPaper(archivedPaperId, true), null, 2), 'utf8');
    assert(fs.existsSync(archivedFilePath), `Created dummy archived paper at staging/archive/${archivedPaperId}.json`);

    // Register it as archived in persistent states
    const statesBeforeArchivedDelete = await fetchPersistentPaperStates();
    if (!statesBeforeArchivedDelete.archived.includes(archivedPaperId)) {
      statesBeforeArchivedDelete.archived.push(archivedPaperId);
    }
    statesBeforeArchivedDelete.deleted = statesBeforeArchivedDelete.deleted.filter((id) => id !== archivedPaperId);
    await savePersistentPaperStates(statesBeforeArchivedDelete);

    const statesCheck = await fetchPersistentPaperStates();
    assert(
      statesCheck.archived.includes(archivedPaperId),
      `Verified "${archivedPaperId}" is registered in paperStates.archived before delete`
    );

    // 2.2 Call DELETE handler via request body
    const deleteArchivedReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: archivedPaperId }),
    });
    const deleteArchivedRes = await DELETE(deleteArchivedReq);
    assert(deleteArchivedRes.status === 200, 'DELETE (body { id }) returns HTTP 200');

    const deleteArchivedData = await deleteArchivedRes.json();
    assert(deleteArchivedData.success === true, 'Archived delete response body has { success: true }');
    assert(deleteArchivedData.action === 'delete', 'Archived delete response has action === "delete"');
    assert(deleteArchivedData.id === archivedPaperId, `Archived delete response contains id "${archivedPaperId}"`);

    // 2.3 Assert local archive file is unlinked
    assert(!fs.existsSync(archivedFilePath), `Local archive file staging/archive/${archivedPaperId}.json was unlinked`);

    // 2.4 Assert persistent state records paper in deleted and REMOVED from archived
    const statesAfterArchivedDelete = await fetchPersistentPaperStates();
    assert(
      statesAfterArchivedDelete.deleted.includes(archivedPaperId),
      `fetchPersistentPaperStates() records "${archivedPaperId}" in "deleted"`
    );
    assert(
      !statesAfterArchivedDelete.archived.includes(archivedPaperId),
      `fetchPersistentPaperStates() removed "${archivedPaperId}" from "archived"`
    );

    // -------------------------------------------------------------
    // CASE 3: Directory Traversal Rejection
    // -------------------------------------------------------------
    console.log('\n--- Case 3: Directory Traversal Rejection ---');

    const maliciousIds = [
      '../forbidden',
      '../../test',
      '../staging/test',
      '../../etc/passwd',
      'foo/bar',
      'subdir/paper',
      '..\\windows',
      '..\\..\\system32',
    ];

    for (const badId of maliciousIds) {
      // Test POST { action: 'delete' }
      const postTraversalReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: badId }),
      });
      const postTraversalRes = await POST(postTraversalReq);
      assert(
        postTraversalRes.status === 400,
        `POST { action: "delete", id: "${badId}" } returns HTTP 400`,
        `Expected 400, received ${postTraversalRes.status}`
      );
      const postTraversalData = await postTraversalRes.json();
      assert(
        postTraversalData.error?.includes('Directory traversal') || postTraversalData.error?.includes('Invalid paper ID'),
        `POST traversal error message for "${badId}" mentions traversal or invalid ID`,
        `Received: "${postTraversalData.error}"`
      );

      // Test DELETE ?id=...
      const deleteTraversalReq = new NextRequest(
        `http://localhost:3000/api/ingest/staged-paper?id=${encodeURIComponent(badId)}`,
        { method: 'DELETE' }
      );
      const deleteTraversalRes = await DELETE(deleteTraversalReq);
      assert(
        deleteTraversalRes.status === 400,
        `DELETE ?id="${badId}" returns HTTP 400`,
        `Expected 400, received ${deleteTraversalRes.status}`
      );
      const deleteTraversalData = await deleteTraversalRes.json();
      assert(
        deleteTraversalData.error?.includes('Directory traversal') || deleteTraversalData.error?.includes('Invalid paper ID'),
        `DELETE traversal error message for "${badId}" mentions traversal or invalid ID`,
        `Received: "${deleteTraversalData.error}"`
      );
    }

    // -------------------------------------------------------------
    // CASE 4: Non-existent Paper Handling
    // -------------------------------------------------------------
    console.log('\n--- Case 4: Non-existent Paper Handling ---');

    const nonExistentId = 'dummy_non_existent_paper_88888';

    // 4.1 POST delete non-existent
    const postNotFoundReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: nonExistentId }),
    });
    const postNotFoundRes = await POST(postNotFoundReq);
    assert(
      postNotFoundRes.status === 404,
      `POST delete on non-existent paper returns HTTP 404`,
      `Expected 404, received ${postNotFoundRes.status}`
    );
    const postNotFoundData = await postNotFoundRes.json();
    assert(
      postNotFoundData.error?.includes('not found'),
      `POST 404 error message indicates not found: "${postNotFoundData.error}"`
    );

    // 4.2 DELETE non-existent
    const deleteNotFoundReq = new NextRequest(
      `http://localhost:3000/api/ingest/staged-paper?id=${nonExistentId}`,
      { method: 'DELETE' }
    );
    const deleteNotFoundRes = await DELETE(deleteNotFoundReq);
    assert(
      deleteNotFoundRes.status === 404,
      `DELETE on non-existent paper returns HTTP 404`,
      `Expected 404, received ${deleteNotFoundRes.status}`
    );
    const deleteNotFoundData = await deleteNotFoundRes.json();
    assert(
      deleteNotFoundData.error?.includes('not found'),
      `DELETE 404 error message indicates not found: "${deleteNotFoundData.error}"`
    );

    // 4.3 Attempting to delete an already-deleted paper returns HTTP 404
    const reDeleteReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: activePaperId }),
    });
    const reDeleteRes = await POST(reDeleteReq);
    assert(
      reDeleteRes.status === 404,
      `Deleting already-deleted paper "${activePaperId}" returns HTTP 404`,
      `Expected 404, received ${reDeleteRes.status}`
    );

    // -------------------------------------------------------------
    // CASE 5: Listing Exclusion
    // -------------------------------------------------------------
    console.log('\n--- Case 5: Listing Exclusion ---');

    // 5.1 GET default listing (active only)
    const listActiveReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
    const listActiveRes = await GET(listActiveReq);
    assert(listActiveRes.status === 200, 'GET /api/ingest/staged-paper returns HTTP 200');

    const listActiveData = await listActiveRes.json();
    assert(
      !listActiveData.papers.includes(activePaperId),
      `Default listing excludes "${activePaperId}" from papers array`
    );
    assert(
      !listActiveData.stagedPapers.some((p: any) => p.id === activePaperId),
      `Default listing excludes "${activePaperId}" from stagedPapers array`
    );
    assert(
      !listActiveData.papers.includes(archivedPaperId),
      `Default listing excludes "${archivedPaperId}" from papers array`
    );
    assert(
      !listActiveData.stagedPapers.some((p: any) => p.id === archivedPaperId),
      `Default listing excludes "${archivedPaperId}" from stagedPapers array`
    );

    // 5.2 GET with include_archived=true
    const listArchivedReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper?include_archived=true');
    const listArchivedRes = await GET(listArchivedReq);
    assert(listArchivedRes.status === 200, 'GET with ?include_archived=true returns HTTP 200');

    const listArchivedData = await listArchivedRes.json();
    assert(
      !listArchivedData.papers.includes(activePaperId),
      `Include_archived listing excludes "${activePaperId}" from papers array`
    );
    assert(
      !listArchivedData.stagedPapers.some((p: any) => p.id === activePaperId),
      `Include_archived listing excludes "${activePaperId}" from stagedPapers array`
    );
    assert(
      !listArchivedData.papers.includes(archivedPaperId),
      `Include_archived listing excludes "${archivedPaperId}" from papers array`
    );
    assert(
      !listArchivedData.stagedPapers.some((p: any) => p.id === archivedPaperId),
      `Include_archived listing excludes "${archivedPaperId}" from stagedPapers array`
    );

    // 5.3 Single paper GET ?id=... on deleted paper returns 404
    const singleDeletedReq = new NextRequest(
      `http://localhost:3000/api/ingest/staged-paper?id=${activePaperId}`
    );
    const singleDeletedRes = await GET(singleDeletedReq);
    assert(
      singleDeletedRes.status === 404,
      `Single GET ?id="${activePaperId}" on deleted paper returns HTTP 404`,
      `Expected 404, received ${singleDeletedRes.status}`
    );

    // 5.4 Orphan file simulation: file exists on disk, but ID is in deletedSet
    fs.writeFileSync(activeFilePath, JSON.stringify(createDummyPaper(activePaperId), null, 2), 'utf8');
    assert(fs.existsSync(activeFilePath), 'Re-created orphan dummy file on disk');

    const orphanListReq = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
    const orphanListRes = await GET(orphanListReq);
    const orphanListData = await orphanListRes.json();
    assert(
      !orphanListData.papers.includes(activePaperId) &&
        !orphanListData.stagedPapers.some((p: any) => p.id === activePaperId),
      `Orphan disk file "${activePaperId}" is ignored and excluded from GET listing because it is in deletedSet`
    );

    const orphanSingleReq = new NextRequest(
      `http://localhost:3000/api/ingest/staged-paper?id=${activePaperId}`
    );
    const orphanSingleRes = await GET(orphanSingleReq);
    assert(
      orphanSingleRes.status === 404,
      `Single GET on orphan disk file "${activePaperId}" returns HTTP 404 because it is in deletedSet`
    );

  } catch (err: any) {
    fail('Unexpected exception during verification execution', err?.message || String(err));
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Purging Temporary Test Artifacts & Storage ---');

    for (const file of [activeFilePath, archivedFilePath, restActiveFilePath]) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log(`  Cleaned up local file: ${path.basename(file)}`);
        } catch (err: any) {
          console.warn(`  Warning: failed to unlink ${file}:`, err?.message);
        }
      }
    }

    try {
      const finalStates = await fetchPersistentPaperStates();
      const prunedDeleted = finalStates.deleted.filter((id) => !allTestIds.includes(id));
      const prunedArchived = finalStates.archived.filter((id) => !allTestIds.includes(id));
      await savePersistentPaperStates({ archived: prunedArchived, deleted: prunedDeleted });
      console.log('  Cleaned up persistent paper_states in Supabase storage');
      pass('Teardown and persistent storage cleanup completed successfully');
    } catch (cleanErr: any) {
      console.warn('  Warning: persistent state cleanup failed:', cleanErr?.message);
    }
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`📋 Verification Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification();
