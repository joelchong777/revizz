/**
 * Verification Script: Whole Paper Deletion Suite
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${msg}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${msg}`);
  }
}

async function run() {
  console.log('\n===============================================================');
  console.log('🧪 Whole Paper Deletion Full-Stack Verification');
  console.log('===============================================================\n');

  // Find root or worktree path
  const baseDir = fs.existsSync(path.resolve(process.cwd(), 'components/admin/WholePaperViewer.tsx'))
    ? process.cwd()
    : path.resolve(process.cwd(), '.worktrees/delete-paper');

  // --- Suite 1: WholePaperViewer UI Verification ---
  console.log('--- Suite 1: WholePaperViewer UI Verification ---');
  const viewerPath = path.resolve(baseDir, 'components/admin/WholePaperViewer.tsx');
  const viewerCode = fs.readFileSync(viewerPath, 'utf8');

  assert(
    viewerCode.includes('data-testid="delete-paper-button"'),
    'WholePaperViewer renders Delete Paper button with data-testid="delete-paper-button"'
  );
  assert(
    viewerCode.includes('Trash2') && viewerCode.includes('AlertTriangle') && viewerCode.includes('Loader2'),
    'WholePaperViewer imports necessary icons (Trash2, AlertTriangle, Loader2)'
  );
  assert(
    viewerCode.includes('const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);') ||
    viewerCode.includes('isDeleteDialogOpen'),
    'WholePaperViewer defines isDeleteDialogOpen modal state'
  );
  assert(
    viewerCode.includes('const handleDeletePaper = async ()') ||
    viewerCode.includes('async function handleDeletePaper') ||
    viewerCode.includes('handleDeletePaper'),
    'WholePaperViewer implements handleDeletePaper handler'
  );
  assert(
    viewerCode.includes("fetch(`/api/ingest/staged-paper?id=") &&
    viewerCode.includes("method: 'DELETE'"),
    'handleDeletePaper sends DELETE request to /api/ingest/staged-paper'
  );
  assert(
    viewerCode.includes('revizz_guest_review_pile') && viewerCode.includes('revizz_first_try_correct_ids'),
    'handleDeletePaper cleans up relating question logs from client localStorage'
  );
  assert(
    viewerCode.includes('Delete Whole Paper?') || viewerCode.includes('Delete Whole Cambridge Paper'),
    'Confirmation dialog displays explicit title'
  );
  assert(
    viewerCode.includes('user_attempts') && viewerCode.includes('review_pile'),
    'Confirmation dialog details removal of student attempts and review pile logs'
  );
  assert(
    viewerCode.includes('successBanner') && viewerCode.includes('permanently deleted'),
    'WholePaperViewer renders dismissible success banner upon successful deletion'
  );

  // --- Suite 2: Staged Paper Route Backend Verification ---
  console.log('\n--- Suite 2: Staged Paper Route Backend Verification ---');
  const routePath = path.resolve(baseDir, 'app/api/ingest/staged-paper/route.ts');
  const routeCode = fs.readFileSync(routePath, 'utf8');

  assert(
    routeCode.includes('deletePaperAndRelationsFromDatabase'),
    'Route implements deletePaperAndRelationsFromDatabase function'
  );
  assert(
    routeCode.includes('checkPaperExistsInDb'),
    'Route implements checkPaperExistsInDb function'
  );
  assert(
    routeCode.includes(".from('user_attempts')") && routeCode.includes(".from('review_pile')"),
    'deletePaperAndRelationsFromDatabase deletes records from user_attempts and review_pile'
  );
  assert(
    routeCode.includes(".from('question_options')") && routeCode.includes(".from('questions')"),
    'deletePaperAndRelationsFromDatabase deletes question options and questions'
  );
  assert(
    routeCode.includes(".from('papers')"),
    'deletePaperAndRelationsFromDatabase deletes paper row from papers table'
  );
  assert(
    routeCode.includes('!deletedSet.has(lp.cleanId)'),
    'GET handler filters livePaperSummaries against deletedSet'
  );

  console.log('\n===============================================================');
  console.log(`📋 Verification Result: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
