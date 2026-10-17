import fs from 'node:fs';
import path from 'node:path';

function runVerification() {
  const hubPath = path.resolve(__dirname, '../components/admin/AppAdminHub.tsx');
  if (!fs.existsSync(hubPath)) {
    console.error(`FAIL: File not found at ${hubPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(hubPath, 'utf8');

  // Check 1: "Direct Question Editor" must NOT be present
  if (content.includes('Direct Question Editor')) {
    console.error('FAIL: Found "Direct Question Editor" header in AppAdminHub.tsx');
    process.exit(1);
  }

  // Check 2: Editor case renders AdminCMS directly
  const hasAdminCMS = content.includes('<AdminCMS initialView="editor" questionId={selectedQuestionId || questions[0]?.id} />');
  if (!hasAdminCMS) {
    console.error('FAIL: Expected `<AdminCMS initialView="editor" questionId={selectedQuestionId || questions[0]?.id} />` in editor case');
    process.exit(1);
  }

  // Check 3: Header container with "Direct Question Editor" icon/styles shouldn't exist
  if (content.includes('Edit3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400"')) {
    console.error('FAIL: Lingering Direct Question Editor icon found in AppAdminHub.tsx');
    process.exit(1);
  }

  console.log('SUCCESS: AppAdminHub.tsx successfully verified. Direct Question Editor header removed and AdminCMS rendered clean.');
}

runVerification();
