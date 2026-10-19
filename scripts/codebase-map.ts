#!/usr/bin/env tsx
/**
 * scripts/codebase-map.ts
 *
 * Ultra-fast (<200ms), zero-dependency TypeScript/Python/SQL symbol & line-range indexer.
 * Maps exports, components, hooks, functions, classes, interfaces, and types to exact
 * 1-indexed line numbers [L<start>-L<end>] using brace-balancing and lexical scanning.
 *
 * Commands:
 *   npx tsx scripts/codebase-map.ts generate       (Generates .agent/CODEBASE_MAP.md and .agent/state/codebase-map.json)
 *   npx tsx scripts/codebase-map.ts query <term>   (Finds symbols and files with exact line numbers)
 *   npx tsx scripts/codebase-map.ts file <path>    (Inspects symbols for a specific file)
 *   --json flag supported on all commands for programmatic subagent consumption.
 */

import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SymbolKind =
  | 'function'
  | 'async-function'
  | 'component'
  | 'hook'
  | 'class'
  | 'interface'
  | 'type'
  | 'const'
  | 'let'
  | 'table'
  | 'trigger'
  | 'sql-function'
  | 'def';

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  exported: boolean;
  signature?: string;
}

export type FileCategory = 'app' | 'components' | 'lib' | 'scripts' | 'supabase' | 'other';

export interface FileMapEntry {
  path: string;
  lineCount: number;
  purpose: string;
  category: FileCategory;
  symbols: SymbolInfo[];
}

export interface CodebaseIndex {
  version: string;
  generatedAt: string;
  stats: {
    totalFiles: number;
    totalLines: number;
    totalSymbols: number;
    scanDurationMs: number;
  };
  sections: Record<FileCategory, FileMapEntry[]>;
  files: FileMapEntry[];
}

// ============================================================================
// Configuration & Known File Purpose Inferences
// ============================================================================

const TARGET_DIRECTORIES = ['app', 'components', 'hooks', 'lib', 'scripts', 'supabase'];
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  '.worktrees',
  '.git',
  'public',
  'staging',
  'dist-test',
  'dist',
  'build',
  '__pycache__',
]);

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.py', '.sql']);

const KNOWN_PURPOSES: Record<string, string> = {
  // App router
  'app/admin/page.tsx': 'Admin dashboard portal page for question management & paper ingestion',
  'app/api/ingest/crop/route.ts': 'API route for diagram bounding box cropping from PDF pages',
  'app/api/ingest/extract/route.ts': 'API route for Gemini paper extraction and question parsing',
  'app/api/ingest/publish/route.ts': 'API route for publishing staged questions into Supabase',
  'app/api/ingest/staged-paper/route.ts': 'API route for staged paper metadata and question retrieval',
  'app/layout.tsx': 'Root layout with neobrutalist aesthetic, fonts, and theme providers',
  'app/not-found.tsx': 'Custom 404 error page with playful neobrutalist styling',
  'app/page.tsx': 'Revizz student home page and interactive quiz game launchpad',
  'app/portal/compiler/print/page.tsx': 'Printable Cambridge exam layout page with bubble sheets',
  'app/portal/page.tsx': 'Teacher and student portal hub with tabs and analytics',

  // Components
  'components/AppShell.tsx': 'Application shell layout with responsive container rules',
  'components/Header.tsx': 'Global header with user profile, streak multiplier, and XP counter',
  'components/LeaderboardModal.tsx': 'Global student XP rankings and school leaderboard modal',
  'components/QuestionCard.tsx': 'Tactile 3D neobrutalist question card with markdown and KaTeX math',
  'components/RoundSummary.tsx': 'End-of-round quiz recap showing XP awarded, accuracy, and review pile',
  'components/SoundToggle.tsx': 'Audio sound effects toggle control with tactile spring physics',
  'components/StartFlow.tsx': 'Interactive topic selector and game launch controller',
  'components/TopicMasteryList.tsx': 'Student syllabus progress tracker and topic mastery tiers',
  'components/admin/AppAdminHub.tsx': 'App admin control hub isolating developer tools from teachers',
  'components/admin/AppAdminNav.tsx': 'Admin navigation bar with tab switching',
  'components/portal/AdminCMS.tsx': 'Question bank CMS table with filtering, search, and inline editor',
  'components/portal/AdminNav.tsx': 'Portal navigation bar with school badge and mode indicator',
  'components/portal/AdminTools.tsx': 'Question audit and management tools for administrators',
  'components/portal/IngestionAuditDrawer.tsx': 'Drawer component for inspecting and auditing question JSON/images',
  'components/portal/IngestionDiagnostics.tsx': 'System diagnostic tools for Cambridge exam ingestion pipeline',
  'components/portal/IngestionHeader.tsx': 'Ingestion studio progress header with batch controls',
  'components/portal/IngestionHub.tsx': 'Cambridge exam ingestion studio frame and workflow selector',
  'components/portal/IngestionLivePreview.tsx': 'Live preview pane rendering extracted questions with math/diagrams',
  'components/portal/IngestionMediaPanel.tsx': 'High-resolution PDF diagram cropper and media asset panel',
  'components/portal/IngestionModals.tsx': 'Dialogs for raw SQL viewer, JSON inspection, and confirmation',
  'components/portal/IngestionOptionsEditor.tsx': 'Interactive 4-option editor with correct-answer toggles and math',
  'components/portal/IngestionPdfViewer.tsx': 'PDF viewer with zoom, page navigation, and crop coordinate overlay',
  'components/portal/IngestionPreviewModal.tsx': 'Full-screen review modal for inspecting questions before database sync',
  'components/portal/IngestionQuestionEditor.tsx': 'Question editor form for stem markdown, topic tagging, and citation',
  'components/portal/IngestionQuestionNav.tsx': 'Thumbnail sidebar navigation for questions with validation badges',
  'components/portal/IngestionSetupWizard.tsx': 'Multi-step setup wizard for PDF upload and Gemini workflow selection',
  'components/portal/IngestionStemEditor.tsx': 'Markdown editor for question stems with KaTeX preview',
  'components/portal/IngestionStudioFrame.tsx': 'Outer layout container for the Cambridge ingestion studio',
  'components/portal/IngestionWorkspace.tsx': 'Split-pane workspace coordinating PDF view and question editor',
  'components/portal/StagingReview.tsx': 'Review interface for staged batch questions awaiting production release',
  'components/portal/TeacherAnalytics.tsx': 'Teacher analytics dashboard for student accuracy and distractor metrics',
  'components/portal/compiler/PrintableExamLayout.tsx': 'Printable Cambridge exam format layout with cover page & mark scheme',
  'components/portal/compiler/TestCompilerHub.tsx': 'Teacher test compiler builder for custom exams, filters, and drafts',
  'components/ui/MarkdownErrorBoundary.tsx': 'Defensive React error boundary isolating math/markdown render failures',
  'components/ui/badge.tsx': 'Neobrutalist badge component with colored borders and soft shadows',
  'components/ui/dialog.tsx': 'Accessible modal dialog wrapper using Radix UI primitives',
  'components/ui/select.tsx': 'Accessible dropdown select menu wrapper using Radix UI primitives',
  'components/ui/tabs.tsx': 'Tab navigation component with accessible keyboard switching',

  // Hooks
  'hooks/useQuizGame.ts': 'Core quiz game loop, scoring, timer, and attempt persistence hook',

  // Lib
  'lib/agentBlackboard.ts': 'Agent coordination blackboard for multi-agent task sharing',
  'lib/audio.ts': 'Tactile sound effect synthesizer using Web Audio API',
  'lib/auth.ts': 'Authentication state, user sanitization, and school account tagging',
  'lib/barcode.tsx': 'Code 128 barcode generator component for printed exam papers',
  'lib/compilerFilters.ts': 'Search, filter, and sort algorithms for teacher test compiler',
  'lib/ingestion/diagramCropper.ts': 'Client-side interface for PDF diagram bounding-box cropping',
  'lib/ingestion/geminiExtractor.ts': 'Gemini 3.8 Flash multimodal API client with backoff and batching',
  'lib/ingestion/katexSanitizer.ts': 'Sanitization utility fixing Cambridge math LaTeX syntax errors',
  'lib/ingestion/useIngestionStore.ts': 'Zustand persistent store for paper ingestion workspace state',
  'lib/leaderboard.ts': 'Leaderboard ranking calculation and score persistence',
  'lib/mastery.ts': 'Leitner review pile storage and topic mastery tier thresholds',
  'lib/questions.ts': 'Cambridge 0455 Economics question bank and topic definitions',
  'lib/scoring.ts': 'Scoring rules, streak multipliers (1.0x-1.5x), and XP math',
  'lib/supabaseClient.ts': 'Supabase client configuration and anonymous fallback',
  'lib/sync.ts': 'Offline attempt queue and background Supabase synchronization',
  'lib/testCompiler.ts': 'Test compiler draft persistence in localStorage and exam compiler',
  'lib/utils.ts': 'Tailwind CSS class merging utility with clsx and twMerge',

  // Scripts
  'scripts/agent-memory.ts': 'Agent memory engine indexing learnings, rules, and reflections',
  'scripts/aggregate-0455-m24-12.ts': 'CLI script aggregating March 2024 paper 12 questions into JSON',
  'scripts/aggregate-0455-s24-12.ts': 'CLI script aggregating Summer 2024 paper 12 questions into JSON',
  'scripts/blackboard.ts': 'CLI interface for multi-agent blackboard state inspection',
  'scripts/crop_box.py': 'PyMuPDF 300 DPI high-resolution diagram cropper CLI',
  'scripts/fast-ingest.py': 'Fast multimodal Gemini ingestion pipeline with bounding box cropping',
  'scripts/generate-upsert-sql.ts': 'Generates SQL upsert queries for Cambridge questions into Supabase',
  'scripts/ingest-paper.ts': 'End-to-end paper ingestion coordinator script',
  'scripts/verify-diagram-cropper.ts': 'Verification test suite for PDF diagram cropper script',
  'scripts/verify-ingestion-nav.ts': 'Verification tests for ingestion studio question navigation',
  'scripts/verify-ingestion-v2.ts': 'Verification suite for ingestion studio v2 features',
  'scripts/verify-ingestion.ts': 'Verification suite for Gemini question extraction',
  'scripts/verify-revizz.ts': 'Master Revizz QA and gameplay test suite with 56 assertions',
  'scripts/verify-ui.ts': 'Headless browser UI tests for neobrutalist components',
  'scripts/wt.ts': 'Git worktree isolation manager and atomic release CLI',
};

// ============================================================================
// File Discovery
// ============================================================================

export function discoverFiles(rootDir: string, dirs: string[] = TARGET_DIRECTORIES): string[] {
  const matchedFiles: string[] = [];

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.agent') continue;
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.has(ext) && !entry.name.endsWith('.d.ts')) {
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          matchedFiles.push(relPath);
        }
      }
    }
  }

  for (const d of dirs) {
    traverse(path.join(rootDir, d));
  }

  return matchedFiles.sort();
}

// ============================================================================
// Purpose Extraction & Inference
// ============================================================================

export function extractPurpose(content: string, relPath: string, symbols: SymbolInfo[]): string {
  if (KNOWN_PURPOSES[relPath]) {
    return KNOWN_PURPOSES[relPath];
  }

  const lines = content.split('\n').slice(0, 30);
  let inBlockComment = false;
  const commentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
      inBlockComment = true;
      const stripped = trimmed.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').trim();
      if (stripped) commentLines.push(stripped);
      if (trimmed.endsWith('*/')) inBlockComment = false;
      continue;
    }
    if (inBlockComment) {
      if (trimmed.endsWith('*/')) {
        inBlockComment = false;
        const stripped = trimmed.replace(/\*\/$/, '').replace(/^\*/, '').trim();
        if (stripped) commentLines.push(stripped);
        break;
      }
      const stripped = trimmed.replace(/^\*/, '').trim();
      if (stripped) commentLines.push(stripped);
      continue;
    }
    if (trimmed.startsWith('//') && !trimmed.startsWith('///')) {
      const stripped = trimmed.replace(/^\/\/\s*/, '').trim();
      if (stripped && !stripped.startsWith('@ts-') && !stripped.startsWith('eslint-')) {
        commentLines.push(stripped);
      }
      continue;
    }
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      const stripped = trimmed.replace(/^("""|''')/, '').replace(/("""|''')$/, '').trim();
      if (stripped) commentLines.push(stripped);
      continue;
    }
    if (trimmed && !trimmed.startsWith('import') && !trimmed.startsWith("'use ") && !trimmed.startsWith('"use ') && !trimmed.startsWith('#!')) {
      if (commentLines.length > 0) break;
    }
  }

  if (commentLines.length > 0) {
    const combined = commentLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^(scripts\/[\w.-]+|app\/[\w.-]+|lib\/[\w.-]+)\s*[-:]?\s*/i, '')
      .trim();
    if (combined.length > 10) {
      const firstSentence = combined.split(/(?<=[.!?])\s+/)[0];
      return firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence;
    }
  }

  const baseName = path.basename(relPath, path.extname(relPath));
  if (relPath.startsWith('app/api/')) {
    return `API endpoint route handler for ${baseName}`;
  }
  if (relPath.startsWith('app/')) {
    return `App router page for ${baseName}`;
  }
  if (relPath.startsWith('components/ui/')) {
    return `Neobrutalist UI design primitive: ${baseName}`;
  }
  if (relPath.startsWith('components/portal/compiler/')) {
    return `Teacher test compiler module: ${baseName}`;
  }
  if (relPath.startsWith('components/portal/')) {
    return `Portal & ingestion component: ${baseName}`;
  }
  if (relPath.startsWith('components/')) {
    return `UI component: ${baseName}`;
  }
  if (relPath.startsWith('hooks/')) {
    return `Custom React hook: ${baseName}`;
  }
  if (relPath.startsWith('lib/ingestion/')) {
    return `Cambridge paper ingestion engine module: ${baseName}`;
  }
  if (relPath.startsWith('lib/')) {
    return `Core library utility module: ${baseName}`;
  }
  if (relPath.startsWith('scripts/verify-')) {
    return `Verification test suite: ${baseName}`;
  }
  if (relPath.startsWith('scripts/')) {
    return `Automation CLI script: ${baseName}`;
  }
  if (relPath.startsWith('supabase/')) {
    return `Database schema and migration: ${baseName}`;
  }

  if (symbols.length > 0) {
    const primary = symbols.find((s) => s.exported) || symbols[0];
    return `Exports ${primary.name} and related utilities`;
  }

  return `Module ${baseName}`;
}

// ============================================================================
// TypeScript/JavaScript AST & Lexical Line Scanner
// ============================================================================

function skipTemplateLiteral(content: string, startPos: number, stringRanges?: [number, number][]): number {
  let pos = startPos + 1;
  let chunkStart = startPos;
  const len = content.length;

  while (pos < len) {
    if (content[pos] === '\\') {
      pos += 2;
      continue;
    }
    if (content[pos] === '$' && pos + 1 < len && content[pos + 1] === '{') {
      if (stringRanges) {
        stringRanges.push([chunkStart, pos + 2]);
      }
      pos += 2;
      let braceDepth = 1;
      while (pos < len && braceDepth > 0) {
        const c = content[pos];
        if (c === '/' && pos + 1 < len && content[pos + 1] === '/') {
          pos += 2;
          while (pos < len && content[pos] !== '\n') pos++;
          continue;
        }
        if (c === '/' && pos + 1 < len && content[pos + 1] === '*') {
          pos += 2;
          while (pos < len && !(content[pos] === '*' && pos + 1 < len && content[pos + 1] === '/')) pos++;
          pos += 2;
          continue;
        }
        if (c === "'" || c === '"') {
          const q = c;
          pos++;
          while (pos < len) {
            if (content[pos] === '\\') {
              pos += 2;
              continue;
            }
            if (content[pos] === q) {
              pos++;
              break;
            }
            pos++;
          }
          continue;
        }
        if (c === '`') {
          pos = skipTemplateLiteral(content, pos, stringRanges);
          continue;
        }
        if (c === '{') {
          braceDepth++;
        } else if (c === '}') {
          braceDepth--;
        }
        pos++;
      }
      chunkStart = pos;
      continue;
    }
    if (content[pos] === '`') {
      pos++;
      if (stringRanges) {
        stringRanges.push([chunkStart, pos]);
      }
      return pos;
    }
    pos++;
  }

  if (stringRanges) {
    stringRanges.push([chunkStart, len]);
  }
  return len;
}

function getIgnoredRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  const len = content.length;
  let pos = 0;

  while (pos < len) {
    const ch = content[pos];
    const next = pos + 1 < len ? content[pos + 1] : '';

    if (ch === '/' && next === '/') {
      const start = pos;
      pos += 2;
      while (pos < len && content[pos] !== '\n') pos++;
      ranges.push([start, pos]);
      continue;
    }

    if (ch === '/' && next === '*') {
      const start = pos;
      pos += 2;
      while (pos < len && !(content[pos] === '*' && pos + 1 < len && content[pos + 1] === '/')) {
        pos++;
      }
      pos += 2;
      ranges.push([start, Math.min(pos, len)]);
      continue;
    }

    if (ch === "'") {
      const start = pos;
      pos++;
      while (pos < len) {
        if (content[pos] === '\\') {
          pos += 2;
          continue;
        }
        if (content[pos] === "'") {
          pos++;
          break;
        }
        pos++;
      }
      ranges.push([start, Math.min(pos, len)]);
      continue;
    }

    if (ch === '"') {
      const start = pos;
      pos++;
      while (pos < len) {
        if (content[pos] === '\\') {
          pos += 2;
          continue;
        }
        if (content[pos] === '"') {
          pos++;
          break;
        }
        pos++;
      }
      ranges.push([start, Math.min(pos, len)]);
      continue;
    }

    if (ch === '`') {
      pos = skipTemplateLiteral(content, pos, ranges);
      continue;
    }

    pos++;
  }

  return ranges;
}

function isInsideRanges(pos: number, ranges: [number, number][]): boolean {
  for (const [start, end] of ranges) {
    if (pos >= start && pos < end) return true;
    if (start > pos) break;
  }
  return false;
}

export function isPascalCaseComponent(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name) && /[a-z]/.test(name) && !name.includes('_');
}

export function isHookName(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

export function parseTypeScriptSymbols(content: string, filePath?: string): SymbolInfo[] {
  const lineStarts: number[] = [0];
  const len = content.length;

  for (let i = 0; i < len; i++) {
    if (content[i] === '\n') {
      lineStarts.push(i + 1);
    }
  }

  function getLineNumber(pos: number): number {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lineStarts[mid] <= pos) {
        if (mid === lineStarts.length - 1 || lineStarts[mid + 1] > pos) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return 1;
  }

  function findDeclarationEnd(startPos: number): number {
    let pos = startPos;
    let bodyBraceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let hasEnteredBody = false;

    while (pos < len) {
      const ch = content[pos];
      const next = pos + 1 < len ? content[pos + 1] : '';

      // Skip single-line comment
      if (ch === '/' && next === '/') {
        pos += 2;
        while (pos < len && content[pos] !== '\n') pos++;
        continue;
      }

      // Skip multi-line comment
      if (ch === '/' && next === '*') {
        pos += 2;
        while (pos < len && !(content[pos] === '*' && pos + 1 < len && content[pos + 1] === '/')) {
          pos++;
        }
        pos += 2;
        continue;
      }

      // Skip single-quote string
      if (ch === "'") {
        pos++;
        while (pos < len) {
          if (content[pos] === '\\') {
            pos += 2;
            continue;
          }
          if (content[pos] === "'") {
            pos++;
            break;
          }
          pos++;
        }
        continue;
      }

      // Skip double-quote string
      if (ch === '"') {
        pos++;
        while (pos < len) {
          if (content[pos] === '\\') {
            pos += 2;
            continue;
          }
          if (content[pos] === '"') {
            pos++;
            break;
          }
          pos++;
        }
        continue;
      }

      // Skip template string completely
      if (ch === '`') {
        pos = skipTemplateLiteral(content, pos);
        continue;
      }

      // Tracking parentheses & brackets
      if (ch === '(') {
        parenDepth++;
        pos++;
        continue;
      }
      if (ch === ')') {
        if (parenDepth > 0) parenDepth--;
        pos++;
        continue;
      }
      if (ch === '[') {
        bracketDepth++;
        pos++;
        continue;
      }
      if (ch === ']') {
        if (bracketDepth > 0) bracketDepth--;
        pos++;
        continue;
      }

      // Tracking body braces
      if (ch === '{') {
        if (!hasEnteredBody) {
          if (parenDepth === 0 && bracketDepth === 0) {
            hasEnteredBody = true;
            bodyBraceDepth = 1;
          }
        } else {
          bodyBraceDepth++;
        }
        pos++;
        continue;
      }

      if (ch === '}') {
        if (hasEnteredBody) {
          bodyBraceDepth--;
          if (bodyBraceDepth === 0) {
            pos++;
            while (pos < len && (content[pos] === ' ' || content[pos] === '\t')) pos++;
            if (pos < len && content[pos] === ';') pos++;
            return Math.max(startPos, pos - 1);
          }
        }
        pos++;
        continue;
      }

      // Semicolon termination when no body has been entered
      if (ch === ';' && !hasEnteredBody && parenDepth === 0 && bracketDepth === 0) {
        return pos;
      }

      // Newline termination for statements without braces or semicolons
      if (ch === '\n' && !hasEnteredBody && parenDepth === 0 && bracketDepth === 0) {
        const nextChunk = content.slice(pos + 1, pos + 50);
        if (/^(export\s|import\s|const\s|let\s|function\s|class\s|interface\s|type\s|\n|$)/.test(nextChunk.trimStart())) {
          return pos;
        }
      }

      pos++;
    }

    return Math.max(startPos, len - 1);
  }

  const ignoredRanges = getIgnoredRanges(content);

  const DECL_REGEX =
    /^(?:export\s+(?:default\s+)?(?:async\s+)?function(?:\s+([a-zA-Z0-9_$]+)|\s*\()|export\s+(?:default\s+)?class\s+([a-zA-Z0-9_$]+)|export\s+interface\s+([a-zA-Z0-9_$]+)|export\s+type\s+([a-zA-Z0-9_$]+)|export\s+(const|let|var)\s+([a-zA-Z0-9_$]+)|export\s*\{\s*([^}]+)\}|export\s+default\s+([a-zA-Z0-9_$]+)|(?:async\s+)?function\s+([A-Z][a-zA-Z0-9_$]*|use[A-Z][a-zA-Z0-9_$]*)|const\s+([A-Z][a-zA-Z0-9_$]*|use[A-Z][a-zA-Z0-9_$]*)\s*(?::\s*[^=]+)?\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+|\(\))?\s*=>|(?:async\s+)?function\s+([a-z][a-zA-Z0-9_$]*))/gm;

  let match: RegExpExecArray | null;
  const recorded = new Map<string, SymbolInfo>();

  while ((match = DECL_REGEX.exec(content)) !== null) {
    const matchedText = match[0];
    const matchIndex = match.index;

    if (isInsideRanges(matchIndex, ignoredRanges)) {
      continue;
    }

    const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
    const leadingWhitespace = content.slice(lineStart, matchIndex);
    if (leadingWhitespace.trim() !== '') continue;

    const startLine = getLineNumber(matchIndex);
    const endChar = findDeclarationEnd(matchIndex + matchedText.length);
    const endLine = Math.max(startLine, getLineNumber(endChar));

    // Case 1: export function / export default function
    if (matchedText.includes('function') && matchedText.includes('export')) {
      let name = match[1];
      if (!name) {
        if (matchedText.includes('default')) {
          const fallback = filePath ? path.basename(filePath, path.extname(filePath)) : 'default';
          name = fallback.charAt(0).toUpperCase() + fallback.slice(1);
        } else {
          name = 'anonymous';
        }
      }
      const isAsync = matchedText.includes('async');
      const isComp = isPascalCaseComponent(name);
      const isHook = isHookName(name);
      const kind: SymbolKind = isComp ? 'component' : isHook ? 'hook' : isAsync ? 'async-function' : 'function';
      recorded.set(name, { name, kind, startLine, endLine, exported: true });
      continue;
    }

    // Case 2: export class
    if (match[2]) {
      const name = match[2];
      recorded.set(name, { name, kind: 'class', startLine, endLine, exported: true });
      continue;
    }

    // Case 3: export interface
    if (match[3]) {
      const name = match[3];
      recorded.set(name, { name, kind: 'interface', startLine, endLine, exported: true });
      continue;
    }

    // Case 4: export type
    if (match[4]) {
      const name = match[4];
      recorded.set(name, { name, kind: 'type', startLine, endLine, exported: true });
      continue;
    }

    // Case 5: export const / let
    if (match[6]) {
      const varType = match[5];
      const name = match[6];
      const isComp = varType === 'const' && isPascalCaseComponent(name);
      const isHook = isHookName(name);
      const kind: SymbolKind = isHook ? 'hook' : isComp ? 'component' : varType === 'const' ? 'const' : 'let';
      recorded.set(name, { name, kind, startLine, endLine, exported: true });
      continue;
    }

    // Case 6: export { A, B as C }
    if (match[7]) {
      const rawList = match[7];
      const parts = rawList.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const subParts = trimmed.split(/\s+as\s+/);
        const originalName = subParts[0].trim();
        const exportName = subParts[1] ? subParts[1].trim() : originalName;

        if (recorded.has(originalName)) {
          const existing = recorded.get(originalName)!;
          existing.exported = true;
          if (exportName !== originalName) {
            recorded.set(exportName, { ...existing, name: exportName });
          }
        } else {
          recorded.set(exportName, {
            name: exportName,
            kind: isHookName(exportName) ? 'hook' : isPascalCaseComponent(exportName) ? 'component' : 'const',
            startLine,
            endLine,
            exported: true,
          });
        }
      }
      continue;
    }

    // Case 7: export default Identifier;
    if (match[8]) {
      const defName = match[8];
      if (recorded.has(defName)) {
        recorded.get(defName)!.exported = true;
      } else {
        recorded.set(defName, {
          name: defName,
          kind: isHookName(defName) ? 'hook' : isPascalCaseComponent(defName) ? 'component' : 'const',
          startLine,
          endLine,
          exported: true,
        });
      }
      continue;
    }

    // Case 8: Top-level PascalCase or Hook function component (even if not prefixed with export)
    if (match[9]) {
      const name = match[9];
      const isHook = /^use[A-Z]/.test(name);
      const kind: SymbolKind = isHook ? 'hook' : 'component';
      if (!recorded.has(name)) {
        recorded.set(name, { name, kind, startLine, endLine, exported: false });
      }
      continue;
    }

    // Case 9: Top-level PascalCase or Hook const arrow component
    if (match[10]) {
      const name = match[10];
      const isHook = /^use[A-Z]/.test(name);
      const kind: SymbolKind = isHook ? 'hook' : 'component';
      if (!recorded.has(name)) {
        recorded.set(name, { name, kind, startLine, endLine, exported: false });
      }
      continue;
    }

    // Case 10: Top-level standalone function (e.g. in test suites or scripts)
    if (match[11]) {
      const name = match[11];
      if (!recorded.has(name)) {
        recorded.set(name, { name, kind: 'function', startLine, endLine, exported: false });
      }
      continue;
    }
  }

  const allList = Array.from(recorded.values()).sort((a, b) => a.startLine - b.startLine);
  const exportedList = allList.filter((s) => s.exported);

  return exportedList.length > 0 ? exportedList : allList;
}

// ============================================================================
// Python AST & Block Indentation Scanner
// ============================================================================

export function parsePythonSymbols(content: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(|^class\s+([a-zA-Z0-9_]+)/);
    if (match) {
      const name = match[1] || match[2];
      const kind: SymbolKind = match[2] ? 'class' : line.startsWith('async') ? 'async-function' : 'def';
      const startLine = i + 1;

      let endLine = startLine;
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine.trim() === '') {
          j++;
          continue;
        }
        if (/^[^\s#]/.test(nextLine)) {
          break;
        }
        endLine = j + 1;
        j++;
      }

      symbols.push({
        name,
        kind,
        startLine,
        endLine,
        exported: true,
      });
    }
  }

  return symbols;
}

// ============================================================================
// SQL Symbol Scanner
// ============================================================================

export function parseSqlSymbols(content: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(
      /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?|FUNCTION\s+|TRIGGER\s+|INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?)(["a-zA-Z0-9_.]+)/i
    );
    if (match) {
      const rawName = match[1].replace(/"/g, '');
      const isTable = /TABLE/i.test(line);
      const isFunc = /FUNCTION/i.test(line);
      const isTrig = /TRIGGER/i.test(line);
      const kind: SymbolKind = isTable ? 'table' : isFunc ? 'sql-function' : isTrig ? 'trigger' : 'const';
      const startLine = i + 1;

      let endLine = startLine;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes(';')) {
          endLine = j + 1;
          break;
        }
      }

      symbols.push({
        name: rawName,
        kind,
        startLine,
        endLine,
        exported: true,
      });
    }
  }

  return symbols;
}

// ============================================================================
// Single File Parser Dispatcher
// ============================================================================

export function parseFile(rootDir: string, relPath: string): FileMapEntry {
  const fullPath = path.join(rootDir, relPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const ext = path.extname(relPath);

  let symbols: SymbolInfo[] = [];
  if (ext === '.ts' || ext === '.tsx') {
    symbols = parseTypeScriptSymbols(content, relPath);
  } else if (ext === '.py') {
    symbols = parsePythonSymbols(content);
  } else if (ext === '.sql') {
    symbols = parseSqlSymbols(content);
  }

  const purpose = extractPurpose(content, relPath, symbols);

  let category: FileCategory = 'other';
  if (relPath.startsWith('app/')) category = 'app';
  else if (relPath.startsWith('components/')) category = 'components';
  else if (relPath.startsWith('hooks/')) category = 'lib';
  else if (relPath.startsWith('lib/')) category = 'lib';
  else if (relPath.startsWith('scripts/')) category = 'scripts';
  else if (relPath.startsWith('supabase/')) category = 'supabase';

  return {
    path: relPath,
    lineCount,
    purpose,
    category,
    symbols,
  };
}

// ============================================================================
// Index Generator & Markdown Formatter
// ============================================================================

export function buildCodebaseIndex(rootDir: string): CodebaseIndex {
  const t0 = Date.now();
  const filePaths = discoverFiles(rootDir);
  const files: FileMapEntry[] = [];

  const sections: Record<FileCategory, FileMapEntry[]> = {
    app: [],
    components: [],
    lib: [],
    scripts: [],
    supabase: [],
    other: [],
  };

  let totalLines = 0;
  let totalSymbols = 0;

  for (const relPath of filePaths) {
    const entry = parseFile(rootDir, relPath);
    files.push(entry);
    sections[entry.category].push(entry);
    totalLines += entry.lineCount;
    totalSymbols += entry.symbols.length;
  }

  const scanDurationMs = Date.now() - t0;

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    stats: {
      totalFiles: files.length,
      totalLines,
      totalSymbols,
      scanDurationMs,
    },
    sections,
    files,
  };
}

export const CORE_CLI_SCRIPTS = new Set([
  'scripts/wt.ts',
  'scripts/codebase-map.ts',
  'scripts/agent-memory.ts',
  'scripts/blackboard.ts',
  'scripts/ingest-paper.ts',
  'scripts/verify-revizz.ts',
  'scripts/verify-ui.ts',
]);

export function formatMarkdownAtlas(index: CodebaseIndex): string {
  const lines: string[] = [];

  lines.push('# Revizz Codebase Atlas & Line Coordinates');
  lines.push('');
  lines.push(
    `> **Automated Symbol Atlas**: Indexing ${index.stats.totalFiles} files, ${index.stats.totalLines.toLocaleString()} lines, and ${index.stats.totalSymbols} symbols across core modules. Generated in ${index.stats.scanDurationMs}ms.`
  );
  lines.push('');
  lines.push('Use `npx tsx scripts/codebase-map.ts query <term>` to search symbols with exact `[L<start>-L<end>]` coordinates.');
  lines.push('');

  const sectionOrder: { title: string; category: FileCategory }[] = [
    { title: '## 1. App Router Pages & API Endpoints (app/)', category: 'app' },
    { title: '## 2. UI & Portal Components (components/)', category: 'components' },
    { title: '## 3. Core Libraries, State, Hooks & Ingestion Engine (lib/, hooks/)', category: 'lib' },
    { title: '## 4. Automation & Verification CLI Scripts (scripts/)', category: 'scripts' },
    { title: '## 5. Database & Supabase Migrations (supabase/)', category: 'supabase' },
  ];

  for (const sec of sectionOrder) {
    lines.push(sec.title);
    lines.push('');
    const entries = index.sections[sec.category];

    if (!entries || entries.length === 0) {
      lines.push(`*(No files currently present in \`${sec.category}/\`)*`);
      lines.push('');
      continue;
    }

    for (const entry of entries) {
      if (sec.category === 'scripts' && !CORE_CLI_SCRIPTS.has(entry.path)) {
        continue;
      }

      // Filter symbols to primary exports/functions/components/hooks
      let primary = entry.symbols.filter(
        (s) =>
          s.exported &&
          (s.endLine - s.startLine >= 3 ||
            ['component', 'hook', 'function', 'async-function', 'class'].includes(s.kind))
      );

      if (primary.length > 5) {
        // Pick top 5 most substantial symbols by line span, re-sorted by startLine
        primary = [...primary]
          .sort((a, b) => (b.endLine - b.startLine) - (a.endLine - a.startLine))
          .slice(0, 5)
          .sort((a, b) => a.startLine - b.startLine);
      } else if (primary.length === 0) {
        primary = entry.symbols.filter((s) => s.exported).slice(0, 3);
        if (primary.length === 0) {
          primary = entry.symbols.slice(0, 3);
        }
      }

      const symList = primary
        .map((s) => `\`${s.name} [L${s.startLine}-L${s.endLine}]\``)
        .join(', ');

      const symbolsPart = symList ? `: ${symList}` : '';

      lines.push(`- **\`${entry.path}\`** (${entry.lineCount} lines)${symbolsPart}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

export const generateMarkdown = formatMarkdownAtlas;

// ============================================================================
// CLI Handler
// ============================================================================

export async function runCli(): Promise<void> {
  const rootDir = process.cwd();
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const filteredArgs = args.filter((a) => a !== '--json');
  const command = filteredArgs[0] || 'generate';

  const jsonOutputPath = path.join(rootDir, '.agent/state/codebase-map.json');
  const mdOutputPath = path.join(rootDir, '.agent/CODEBASE_MAP.md');

  if (command === 'generate') {
    const t0 = Date.now();
    const index = buildCodebaseIndex(rootDir);
    const mdContent = formatMarkdownAtlas(index);

    // Ensure output directories exist
    fs.mkdirSync(path.dirname(jsonOutputPath), { recursive: true });
    fs.writeFileSync(jsonOutputPath, JSON.stringify(index, null, 2), 'utf-8');
    fs.writeFileSync(mdOutputPath, mdContent, 'utf-8');

    const duration = Date.now() - t0;

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            success: true,
            files: index.stats.totalFiles,
            lines: index.stats.totalLines,
            symbols: index.stats.totalSymbols,
            durationMs: duration,
            jsonPath: '.agent/state/codebase-map.json',
            mdPath: '.agent/CODEBASE_MAP.md',
          },
          null,
          2
        )
      );
    } else {
      console.log(`[Codebase Map] Indexed ${index.stats.totalFiles} files (${index.stats.totalLines.toLocaleString()} lines, ${index.stats.totalSymbols} symbols) in ${duration}ms.`);
      console.log(`✓ Saved JSON index to: .agent/state/codebase-map.json`);
      console.log(`✓ Saved Markdown atlas to: .agent/CODEBASE_MAP.md`);
    }
    return;
  }

  if (command === 'query' || command === 'search') {
    const term = filteredArgs[1];
    if (!term) {
      console.error('Error: query command requires a search term. Usage: npx tsx scripts/codebase-map.ts query <term>');
      process.exit(1);
    }

    const t0 = Date.now();
    let index: CodebaseIndex;

    // Fast-path: read existing json index if present
    if (fs.existsSync(jsonOutputPath)) {
      index = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf-8'));
    } else {
      index = buildCodebaseIndex(rootDir);
    }

    const lowerTerm = term.toLowerCase();
    const matches: {
      file: string;
      lineCount: number;
      purpose: string;
      matchingSymbols: SymbolInfo[];
    }[] = [];

    for (const f of index.files) {
      const pathMatches = f.path.toLowerCase().includes(lowerTerm);
      const matchedSyms = f.symbols.filter(
        (s) => s.name.toLowerCase().includes(lowerTerm) || s.kind.toLowerCase().includes(lowerTerm)
      );

      if (pathMatches || matchedSyms.length > 0) {
        matches.push({
          file: f.path,
          lineCount: f.lineCount,
          purpose: f.purpose,
          matchingSymbols: matchedSyms.length > 0 ? matchedSyms : f.symbols,
        });
      }
    }

    const duration = Date.now() - t0;

    if (isJson) {
      console.log(JSON.stringify({ query: term, count: matches.length, durationMs: duration, matches }, null, 2));
    } else {
      console.log(`\nFound ${matches.length} matching file(s) for "${term}" in ${duration}ms:\n`);
      for (const m of matches) {
        console.log(`\x1b[1m\x1b[36m• ${m.file}\x1b[0m (${m.lineCount} lines) — \x1b[90m${m.purpose}\x1b[0m`);
        if (m.matchingSymbols.length > 0) {
          for (const s of m.matchingSymbols) {
            console.log(`  └─ \x1b[32m${s.name}\x1b[0m [L${s.startLine}-L${s.endLine}] (${s.kind})`);
          }
        }
      }
      console.log('');
    }
    return;
  }

  if (command === 'file') {
    const targetFile = filteredArgs[1];
    if (!targetFile) {
      console.error('Error: file command requires a file path. Usage: npx tsx scripts/codebase-map.ts file <path>');
      process.exit(1);
    }

    const relPath = targetFile.replace(/^\.\//, '').replace(/\\/g, '/');
    const fullPath = path.join(rootDir, relPath);

    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found: ${targetFile}`);
      process.exit(1);
    }

    const entry = parseFile(rootDir, relPath);

    if (isJson) {
      console.log(JSON.stringify(entry, null, 2));
    } else {
      console.log(`\n\x1b[1mFile: ${entry.path}\x1b[0m (${entry.lineCount} lines)`);
      console.log(`Category: ${entry.category}`);
      console.log(`Purpose:  ${entry.purpose}`);
      console.log(`Symbols (${entry.symbols.length}):`);
      for (const s of entry.symbols) {
        console.log(`  • \x1b[32m${s.name}\x1b[0m [L${s.startLine}-L${s.endLine}] (${s.kind})`);
      }
      console.log('');
    }
    return;
  }

  console.error(`Unknown command: ${command}. Available commands: generate, query <term>, file <path>`);
  process.exit(1);
}

// Direct CLI invocation check
if (require.main === module || process.argv[1]?.endsWith('codebase-map.ts')) {
  runCli().catch((err) => {
    console.error('Error executing codebase-map:', err);
    process.exit(1);
  });
}
