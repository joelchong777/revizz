#!/usr/bin/env tsx
/**
 * Cambridge Mark Scheme Checker & Auto-Remediator CLI
 *
 * Usage:
 *   npx tsx scripts/check-mark-scheme.ts <paper_id_or_path> [options]
 *   npx tsx scripts/check-mark-scheme.ts --all [options]
 *
 * Options:
 *   --fix         Auto-remediates mismatches and overwrites the JSON file
 *   --ms <path>   Provide custom mark scheme PDF file path
 *   --help        Show this help message
 */

import fs from 'fs';
import path from 'path';
import { parseMarkSchemePdf, findMarkSchemePdf } from '../lib/ingestion/markSchemeParser';
import { verifyPaperAgainstMarkScheme, type MarkSchemeVerificationReport } from '../lib/ingestion/markSchemeChecker';
import { remediatePaperWithMarkScheme } from '../lib/ingestion/markSchemeRemediator';
import type { StagingPaper } from '../types/ingestion';

// ANSI formatting helpers
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface CliArgs {
  target?: string;
  all: boolean;
  fix: boolean;
  customMs?: string;
  help: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {
    all: false,
    fix: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      parsed.all = true;
    } else if (arg === '--fix') {
      parsed.fix = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--ms') {
      parsed.customMs = args[++i];
    } else if (!arg.startsWith('-') && !parsed.target) {
      parsed.target = arg;
    }
  }

  return parsed;
}

function printUsage() {
  console.log(`
${bold('Cambridge Mark Scheme Checker & Auto-Remediator')}

${bold('Usage:')}
  npx tsx scripts/check-mark-scheme.ts <paper_id_or_path> [options]
  npx tsx scripts/check-mark-scheme.ts --all [options]

${bold('Options:')}
  --fix         Auto-remediates mismatches and updates the staging JSON file
  --ms <path>   Provide explicit mark scheme PDF file path
  --all         Check all staging JSON files in staging/
  --help        Show this help message

${bold('Examples:')}
  npx tsx scripts/check-mark-scheme.ts 0455_s24_11
  npx tsx scripts/check-mark-scheme.ts staging/0455_s24_12.json --fix
  npx tsx scripts/check-mark-scheme.ts --all
  npx tsx scripts/check-mark-scheme.ts 0455_s24_11 --ms "Economics (0455)/2024/2024 June/0455_s24_ms_11.pdf"
`);
}

function resolvePaperFiles(target?: string, all?: boolean): string[] {
  const stagingDirs = [
    path.resolve(process.cwd(), 'staging'),
    path.resolve(process.cwd(), '../../staging'),
  ];

  if (all) {
    const fileSet = new Set<string>();
    for (const dir of stagingDirs) {
      if (fs.existsSync(dir)) {
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.json') && !f.startsWith('.'))
          .map((f) => path.join(dir, f));
        for (const file of files) fileSet.add(file);
      }
    }
    return Array.from(fileSet).sort();
  }

  if (!target) return [];

  // Check if target is a direct path
  const directPath = path.resolve(process.cwd(), target);
  if (fs.existsSync(directPath)) return [directPath];

  // Try appending .json
  if (fs.existsSync(`${directPath}.json`)) return [`${directPath}.json`];

  // Search staging directories
  const baseName = path.basename(target, '.json');
  for (const dir of stagingDirs) {
    const candidate = path.join(dir, `${baseName}.json`);
    if (fs.existsSync(candidate)) return [candidate];
  }

  return [];
}

async function run() {
  const rawArgs = process.argv.slice(2);
  const args = parseArgs(rawArgs);

  if (args.help || (!args.target && !args.all)) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const paperFiles = resolvePaperFiles(args.target, args.all);
  if (paperFiles.length === 0) {
    console.error(red(`Error: No staging JSON file found for target "${args.target}".`));
    process.exit(1);
  }

  console.log(bold(cyan(`\n🔍 Cambridge Mark Scheme Verification Engine`)));
  console.log(dim(`Processing ${paperFiles.length} paper file(s)...\n`));

  let totalPapers = 0;
  let passedPapers = 0;
  let failedPapers = 0;
  let totalMismatches = 0;
  let totalFixed = 0;

  for (const filePath of paperFiles) {
    totalPapers++;
    const paperName = path.basename(filePath);
    console.log(bold(`────────────────────────────────────────────────────────────`));
    console.log(bold(`Paper: ${paperName}`) + dim(` (${filePath})`));

    let paperData: StagingPaper;
    try {
      const rawContent = fs.readFileSync(filePath, 'utf8');
      paperData = JSON.parse(rawContent);
    } catch (e: any) {
      console.error(red(`  ✖ Failed to read or parse JSON file: ${e.message}`));
      failedPapers++;
      continue;
    }

    // Auto-discover Mark Scheme PDF
    const msPath = findMarkSchemePdf(paperData, args.customMs);
    if (!msPath) {
      console.warn(yellow(`  ⚠ Mark Scheme PDF not found for ${paperName}. Skipping verification.`));
      continue;
    }

    console.log(dim(`  Mark Scheme: ${msPath}`));

    let msMap: Record<number, any>;
    try {
      msMap = await parseMarkSchemePdf(msPath);
    } catch (e: any) {
      console.error(red(`  ✖ Failed to parse Mark Scheme PDF: ${e.message}`));
      failedPapers++;
      continue;
    }

    // Run verification
    let report: MarkSchemeVerificationReport = verifyPaperAgainstMarkScheme(paperData, msMap, msPath);

    if (report.status === 'perfect_match') {
      console.log(green(`  ✔ ${report.summary}`));
      passedPapers++;
    } else {
      console.log(red(`  ✖ ${report.summary}`));
      totalMismatches += report.mismatchCount;

      // Print mismatch detail table
      console.log(`\n  ${bold('Mismatches Found:')}`);
      console.log(
        `  ${bold('Q#'.padEnd(5))} ${bold('Staged'.padEnd(8))} ${bold('MS'.padEnd(6))} ${bold('Description')}`
      );
      console.log(`  ${'─'.repeat(4)} ${'─'.repeat(6)} ${'─'.repeat(4)} ${'─'.repeat(50)}`);

      for (const m of report.mismatches) {
        const qStr = String(m.questionNumber).padEnd(5);
        const stStr = (m.stagedKey || 'None').padEnd(8);
        const expStr = m.expectedKey.padEnd(6);
        console.log(`  ${yellow(qStr)} ${red(stStr)} ${green(expStr)} ${m.description}`);
      }
      console.log('');

      if (args.fix) {
        console.log(cyan(`  ⚡ Applying auto-remediation to ${paperName}...`));
        const remediation = remediatePaperWithMarkScheme(paperData, msMap);

        if (remediation.fixedCount > 0) {
          // Re-verify the fixed paper
          const postReport = verifyPaperAgainstMarkScheme(remediation.fixedPaper, msMap, msPath);
          fs.writeFileSync(filePath, JSON.stringify(remediation.fixedPaper, null, 2) + '\n');
          console.log(green(`  ✔ Successfully remediated ${remediation.fixedCount} question(s).`));
          console.log(green(`  ✔ File updated: ${filePath}`));
          console.log(dim(`  ✔ Post-remediation status: ${postReport.status} (${postReport.matchedCount}/${postReport.totalQuestions} matched)`));
          totalFixed += remediation.fixedCount;
          passedPapers++;
        } else {
          console.log(yellow(`  ⚠ No auto-remediations could be safely applied.`));
          failedPapers++;
        }
      } else {
        console.log(dim(`  Tip: Run with --fix to automatically correct these mismatches.`));
        failedPapers++;
      }
    }
  }

  console.log(bold(`\n════════════════════════════════════════════════════════════`));
  console.log(bold(`SUMMARY RESULTS`));
  console.log(`  Total Papers Evaluated: ${totalPapers}`);
  console.log(`  Passed / Verified:      ${green(String(passedPapers))}`);
  if (failedPapers > 0) {
    console.log(`  Failed / Unresolved:    ${red(String(failedPapers))}`);
  }
  if (totalMismatches > 0) {
    console.log(`  Total Mismatches:       ${yellow(String(totalMismatches))}`);
  }
  if (totalFixed > 0) {
    console.log(`  Auto-Remediated:        ${green(String(totalFixed))}`);
  }
  console.log(bold(`════════════════════════════════════════════════════════════\n`));

  if (failedPapers > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
