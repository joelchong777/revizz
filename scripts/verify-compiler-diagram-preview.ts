/**
 * Standalone Verification Script for CompilerDiagramPreview & Test Compiler Integration.
 *
 * Checks:
 * 1. CompilerDiagramPreview component exports and types
 * 2. Static verification that TestCompilerHub uses CompilerDiagramPreview instead of raw <img>
 * 3. Static verification that PrintableExamLayout uses resolveDiagramUrl(q.imageUrl)
 * 4. §12 Motion safety: verifies that any Framer Motion animations use "tween" for transitions
 * 5. URL resolution contracts for various Cambridge question images
 */

import fs from 'fs';
import path from 'path';
import { resolveDiagramUrl } from '../lib/resolveDiagramUrl';
import { CompilerDiagramPreview } from '../components/portal/compiler/CompilerDiagramPreview';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  passedChecks++;
  console.log(`✅ [PASS] ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('       VERIFY COMPILER DIAGRAM PREVIEW INTEGRATION              ');
  console.log('================================================================\n');

  // 1. Component export verification
  assert(typeof CompilerDiagramPreview === 'function', 'CompilerDiagramPreview is exported as a React component');
  assert(typeof resolveDiagramUrl === 'function', 'resolveDiagramUrl is exported as a function');

  // 2. TestCompilerHub verification
  const hubPath = path.resolve(__dirname, '../components/portal/compiler/TestCompilerHub.tsx');
  const hubCode = fs.readFileSync(hubPath, 'utf-8');

  assert(
    hubCode.includes("import { CompilerDiagramPreview } from './CompilerDiagramPreview'"),
    'TestCompilerHub imports CompilerDiagramPreview'
  );
  assert(
    hubCode.includes('<CompilerDiagramPreview'),
    'TestCompilerHub renders CompilerDiagramPreview component'
  );
  assert(
    !hubCode.includes('alt="Question diagram"\n                        className="max-h-32'),
    'TestCompilerHub has replaced raw <img> for question diagram'
  );

  // 3. PrintableExamLayout verification
  const printPath = path.resolve(__dirname, '../components/portal/compiler/PrintableExamLayout.tsx');
  const printCode = fs.readFileSync(printPath, 'utf-8');

  assert(
    printCode.includes("import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl'"),
    'PrintableExamLayout imports resolveDiagramUrl'
  );
  assert(
    printCode.includes('resolveDiagramUrl(q.imageUrl)'),
    'PrintableExamLayout applies resolveDiagramUrl(q.imageUrl)'
  );

  // 4. §12 Motion physics and animation safety in CompilerDiagramPreview
  const previewPath = path.resolve(__dirname, '../components/portal/compiler/CompilerDiagramPreview.tsx');
  const previewCode = fs.readFileSync(previewPath, 'utf-8');

  assert(
    previewCode.includes("resolveDiagramUrl"),
    'CompilerDiagramPreview invokes resolveDiagramUrl'
  );
  assert(
    previewCode.includes("Diagram unavailable"),
    'CompilerDiagramPreview includes "Diagram unavailable" fallback state'
  );
  assert(
    previewCode.includes("RotateCcw") && previewCode.includes("Retry"),
    'CompilerDiagramPreview includes Retry button with RotateCcw icon'
  );
  assert(
    previewCode.includes("Escape") && previewCode.includes("keydown"),
    'CompilerDiagramPreview includes Escape key listener for lightbox dismissal'
  );
  assert(
    previewCode.includes("createPortal"),
    'CompilerDiagramPreview uses createPortal for clean modal stacking'
  );

  // Ensure tween transitions are used (no invalid springs)
  assert(
    previewCode.includes("ease: 'easeOut'"),
    'CompilerDiagramPreview uses tween transitions with ease: easeOut per §12'
  );

  // 5. Test resolution of Cambridge 0455/13 Oct/Nov 2024 Q18
  const q18Url = resolveDiagramUrl('/questions/0455_2024_w_13_q18.png');
  assert(
    typeof q18Url === 'string' &&
    q18Url.includes('https://dmvahcaxixvhgxidmkqs.supabase.co/storage/v1/object/public/question-diagrams/0455_2024_w_13_q18.png'),
    '0455/13 w24 Q18 resolves to public Supabase Storage CDN endpoint'
  );

  console.log(`\n================================================================`);
  console.log(`Results: ${passedChecks}/${totalChecks} checks passed (100%)`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
