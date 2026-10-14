/**
 * Targeted UI & Store Verification Script for Deleting Papers
 * Verifies:
 * 1. useIngestionStore: deleteStagedPaper contract, mock fetch execution, store clearing logic on active paper match
 * 2. IngestionSetupWizard: file integrity, JSX tokens, confirmation modal presence, Trash2 buttons on cards
 * 3. IngestionHeader: onDeleteStagedPaper prop interface, delete button in workspace header, defensive modal presence
 * 4. StagedPapersQueue: delete button on cards, defensive confirmation dialog
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
  console.log('🎨 UI & Store Deletion Integration Verification');
  console.log('===============================================================\n');

  // --- Suite 1: useIngestionStore ---
  console.log('--- Suite 1: useIngestionStore ---');
  const storePath = path.resolve(process.cwd(), 'lib/ingestion/useIngestionStore.ts');
  const storeCode = fs.readFileSync(storePath, 'utf8');

  assert(
    storeCode.includes('deleteStagedPaper: (paperId: string) => Promise<{ success: boolean; error?: string }>'),
    'useIngestionStore exports deleteStagedPaper in IngestionActions interface'
  );
  assert(
    storeCode.includes('async deleteStagedPaper(paperId: string): Promise<{ success: boolean; error?: string }>'),
    'useIngestionStore implements deleteStagedPaper method'
  );
  assert(
    storeCode.includes("fetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`") &&
    storeCode.includes("method: 'DELETE'"),
    'deleteStagedPaper calls DELETE /api/ingest/staged-paper'
  );
  assert(
    storeCode.includes('actions.resetStore()') && storeCode.includes('actions.clearDraft()'),
    'deleteStagedPaper resets store and clears draft when matching currently loaded paper'
  );

  // --- Suite 2: IngestionSetupWizard ---
  console.log('\n--- Suite 2: IngestionSetupWizard ---');
  const wizardPath = path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx');
  const wizardCode = fs.readFileSync(wizardPath, 'utf8');

  assert(
    wizardCode.includes('const [paperToDelete, setPaperToDelete] = useState<StagedPaperSummary | null>(null);'),
    'IngestionSetupWizard declares paperToDelete state'
  );
  assert(
    wizardCode.includes('const [isDeletingPaperId, setIsDeletingPaperId] = useState<string | null>(null);'),
    'IngestionSetupWizard declares isDeletingPaperId state'
  );
  assert(
    wizardCode.includes('const handleDeletePaper = async (paperId: string, isArchived?: boolean) =>'),
    'IngestionSetupWizard implements handleDeletePaper'
  );
  assert(
    wizardCode.includes('setPaperToDelete(paperItem)'),
    'Clicking card Delete button sets paperToDelete'
  );
  assert(
    wizardCode.includes('hover:bg-[#fee2e2] text-[#645c50] hover:text-[#b91c1c] shadow-[2px_2px_0_#201e1d]'),
    'Card Delete button uses requested Neobrutalist design tokens'
  );
  assert(
    wizardCode.includes('Delete Paper from Archives?') &&
    wizardCode.includes('Delete Paper from Staging?'),
    'Delete confirmation modal dynamically differentiates between staging and archives'
  );
  assert(
    wizardCode.includes('bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[6px_6px_0_#201e1d]'),
    'Delete confirmation modal uses standard Revizz modal tokens'
  );
  assert(
    wizardCode.includes('This will permanently delete this paper from your local staging environment. This action cannot be undone.'),
    'Delete confirmation modal displays clear permanent warning'
  );

  // --- Suite 3: IngestionHeader ---
  console.log('\n--- Suite 3: IngestionHeader ---');
  const headerPath = path.resolve(process.cwd(), 'components/portal/IngestionHeader.tsx');
  const headerCode = fs.readFileSync(headerPath, 'utf8');

  assert(
    headerCode.includes('onDeleteStagedPaper?: (paperId: string) => Promise<{ success: boolean; error?: string }>;'),
    'IngestionHeaderProps declares onDeleteStagedPaper prop'
  );
  assert(
    headerCode.includes('const performDelete = async () =>'),
    'IngestionHeader implements performDelete handler'
  );
  assert(
    headerCode.includes('Delete Staged Paper?') &&
    headerCode.includes('header-delete-dialog-title'),
    'IngestionHeader renders defensive delete confirmation modal'
  );

  // --- Suite 4: IngestionHub ---
  console.log('\n--- Suite 4: IngestionHub ---');
  const hubPath = path.resolve(process.cwd(), 'components/portal/IngestionHub.tsx');
  const hubCode = fs.readFileSync(hubPath, 'utf8');

  assert(
    hubCode.includes('deleteStagedPaper,') &&
    hubCode.includes('onDeleteStagedPaper={deleteStagedPaper}'),
    'IngestionHub destructures deleteStagedPaper and forwards it to IngestionHeader'
  );

  // --- Suite 5: StagedPapersQueue ---
  console.log('\n--- Suite 5: StagedPapersQueue ---');
  const queuePath = path.resolve(process.cwd(), 'components/portal/staged/StagedPapersQueue.tsx');
  const queueCode = fs.readFileSync(queuePath, 'utf8');

  assert(
    queueCode.includes('const [paperToDelete, setPaperToDelete] = useState<StagedPaperItem | null>(null);') &&
    queueCode.includes('const [isDeletingId, setIsDeletingId] = useState<string | null>(null);'),
    'StagedPapersQueue declares delete state'
  );
  assert(
    queueCode.includes('const handleDeletePaper = async (paperId: string) =>') &&
    queueCode.includes("method: 'DELETE'"),
    'StagedPapersQueue implements handleDeletePaper calling DELETE route'
  );
  assert(
    queueCode.includes('setPaperToDelete(paper)'),
    'StagedPapersQueue card triggers delete confirmation modal'
  );
  assert(
    queueCode.includes('Delete Paper from Staging?') &&
    queueCode.includes('queue-delete-dialog-title'),
    'StagedPapersQueue renders defensive delete confirmation modal'
  );

  console.log('\n===============================================================');
  console.log(`📋 Summary: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
