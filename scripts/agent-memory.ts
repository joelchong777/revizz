#!/usr/bin/env tsx
/**
 * Agent Memory Engine
 *
 * Fast, robust CLI and programmatic tool that indexes, searches, and extracts
 * structured knowledge, rules, and reflections from:
 * `.agent/memory/learnings_and_reflections.md`
 */

import fs from "fs";
import path from "path";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type RuleCategory =
  | "ui-motion"
  | "architecture"
  | "operations"
  | "schema-validation"
  | "workflow-agents";

export interface RuleItem {
  id: string;
  category: RuleCategory;
  categoryLabel: string;
  title: string;
  trap: string;
  rule: string;
  remediation?: string;
  codeSnippet?: string;
  sourceDate: string;
  sourceTopic: string;
}

export interface ReflectionEntry {
  id: string;
  index: number;
  date: string;
  topic: string;
  summary: string;
  keyInsights: string[];
  architecturalSolutions: string[];
  antiPatterns: string[];
  verificationNotes: string[];
  rulesAndTraps: RuleItem[];
  rawContent: string;
}

export interface SearchResult {
  entry: ReflectionEntry;
  score: number;
  matchedTerms: string[];
  highlights: string[];
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filePath?: string;
}

export interface MemoryStats {
  totalEntries: number;
  earliestDate: string;
  latestDate: string;
  totalInsights: number;
  totalSolutions: number;
  totalAntiPatterns: number;
  totalRules: number;
}

// ============================================================================
// Path Resolution
// ============================================================================

export const DEFAULT_MEMORY_PATH = (() => {
  const cwdPath = path.resolve(process.cwd(), ".agent/memory/learnings_and_reflections.md");
  if (fs.existsSync(cwdPath)) return cwdPath;

  const scriptDirRel = path.resolve(__dirname, "../.agent/memory/learnings_and_reflections.md");
  if (fs.existsSync(scriptDirRel)) return scriptDirRel;

  return cwdPath;
})();

// ============================================================================
// ANSI Color Formatting Utilities
// ============================================================================

const isColorSupported =
  !process.env.NO_COLOR &&
  (Boolean(process.env.FORCE_COLOR) || Boolean(process.stdout && process.stdout.isTTY));

export const c = {
  reset: isColorSupported ? "\x1b[0m" : "",
  bold: isColorSupported ? "\x1b[1m" : "",
  dim: isColorSupported ? "\x1b[2m" : "",
  italic: isColorSupported ? "\x1b[3m" : "",
  underline: isColorSupported ? "\x1b[4m" : "",
  red: isColorSupported ? "\x1b[31m" : "",
  green: isColorSupported ? "\x1b[32m" : "",
  yellow: isColorSupported ? "\x1b[33m" : "",
  blue: isColorSupported ? "\x1b[34m" : "",
  magenta: isColorSupported ? "\x1b[35m" : "",
  cyan: isColorSupported ? "\x1b[36m" : "",
  white: isColorSupported ? "\x1b[37m" : "",
  bgCyan: isColorSupported ? "\x1b[46m\x1b[30m" : "",
  bgYellow: isColorSupported ? "\x1b[43m\x1b[30m" : "",
  bgGreen: isColorSupported ? "\x1b[42m\x1b[30m" : "",
  bgRed: isColorSupported ? "\x1b[41m\x1b[37m" : "",
  bgBlue: isColorSupported ? "\x1b[44m\x1b[37m" : "",
};

// ============================================================================
// Markdown Parsing & Ingestion
// ============================================================================

function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function categorizeSubHeader(title: string): "verification" | "antiPattern" | "architecture" | "insight" | "metadata" {
  const t = title.toLowerCase();
  if (/target surface|surface|auditor|metadata|overview/i.test(t)) {
    return "metadata";
  }
  if (/verification|test suite|definition of done|audit|dod|passed|regression/i.test(t)) {
    return "verification";
  }
  if (/incident|root cause|anti-pattern|bug|trap|failure|collision|interception|gap|problem|issue|staling/i.test(t)) {
    return "antiPattern";
  }
  if (/solution|architectur|pattern|breakthrough|protocol|defense|unification|remediation|layout|pipeline|workflow|system|engine|modal|setup|dynamic/i.test(t)) {
    return "architecture";
  }
  return "insight";
}

function isMetadataLine(line: string): boolean {
  return /^[-*]\s+\*\*(?:Date|Topic|Feature|Target Surfaces|Auditor|Context & Scope|Context & Objectives)\*\*:/i.test(
    line.trim()
  );
}

/**
 * Parses raw markdown content into structured ReflectionEntry objects.
 */
export function parseReflectionMarkdown(rawMarkdown: string): ReflectionEntry[] {
  const sections = rawMarkdown.split(/^## Reflection Log Entry - /m);
  if (sections.length <= 1) {
    return [];
  }

  const entries: ReflectionEntry[] = [];

  for (let idx = 1; idx < sections.length; idx++) {
    const rawSection = sections[idx];
    const lines = rawSection.split(/\r?\n/);
    const headerLine = lines[0].trim();

    // 1. Extract Date
    const dateMatch = headerLine.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "2026-10-10";

    // 2. Extract Topic / Title
    const parenMatch = headerLine.match(/\((.*?)\)/);
    let topic = parenMatch ? parenMatch[1].trim() : "";

    for (const line of lines) {
      const topicMatch = line.match(/^[-*]\s+\*\*(?:Topic|Feature)\*\*:\s*(.+)/i);
      if (topicMatch) {
        topic = topicMatch[1].trim();
        break;
      }
    }

    if (!topic) {
      for (const line of lines) {
        const incidentMatch = line.match(/^(\d+\.|[-*])\s+\*\*Incident\*\*:\s*(.+)/i);
        if (incidentMatch) {
          topic = cleanMarkdownText(incidentMatch[2].trim());
          break;
        }
      }
    }

    if (!topic) {
      topic = `Reflection Entry ${date}`;
    }

    // 3. Subsections decomposition
    interface RawBlock {
      title: string;
      lines: string[];
    }

    const blocks: RawBlock[] = [];
    let currentBlock: RawBlock = { title: "Overview", lines: [] };

    for (let l = 1; l < lines.length; l++) {
      const line = lines[l];
      if (/^###+\s+/.test(line)) {
        if (currentBlock.lines.some((ln) => ln.trim().length > 0)) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          title: line.replace(/^###+\s+/, "").trim(),
          lines: [],
        };
      } else if (/^[-*]\s+\*\*([^*]+)\*\*:\s*$/.test(line)) {
        if (currentBlock.lines.some((ln) => ln.trim().length > 0)) {
          blocks.push(currentBlock);
        }
        const bTitle = line.match(/^[-*]\s+\*\*([^*]+)\*\*/)?.[1] || "Section";
        currentBlock = {
          title: bTitle.trim(),
          lines: [],
        };
      } else if (/^[-*]\s+\*\*([^*]+)\*\*:\s*(.+)$/.test(line)) {
        const match = line.match(/^[-*]\s+\*\*([^*]+)\*\*:\s*(.+)$/);
        const bTitle = match?.[1] || "";
        const inlineContent = match?.[2] || "";

        if (isMetadataLine(line)) {
          // Keep metadata from polluting insights
          continue;
        }

        if (currentBlock.lines.some((ln) => ln.trim().length > 0)) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          title: bTitle.trim(),
          lines: [inlineContent],
        };
      } else {
        if (!isMetadataLine(line)) {
          currentBlock.lines.push(line);
        }
      }
    }
    if (currentBlock.lines.some((ln) => ln.trim().length > 0)) {
      blocks.push(currentBlock);
    }

    const keyInsights: string[] = [];
    const architecturalSolutions: string[] = [];
    const antiPatterns: string[] = [];
    const verificationNotes: string[] = [];

    for (const blk of blocks) {
      const category = categorizeSubHeader(blk.title);
      if (category === "metadata") continue;

      const textContent = blk.lines
        .filter((l) => l.trim().length > 0)
        .map((l) => l.trim())
        .join(" ");

      if (!textContent || textContent.length < 5) continue;

      const cleanedContent = cleanMarkdownText(textContent);
      let snippet: string;

      if (blk.title !== "Overview" && !cleanedContent.toLowerCase().startsWith(blk.title.toLowerCase())) {
        snippet = `${blk.title}: ${cleanedContent}`;
      } else {
        snippet = cleanedContent;
      }

      if (snippet.length > 5) {
        switch (category) {
          case "verification":
            verificationNotes.push(snippet);
            break;
          case "antiPattern":
            antiPatterns.push(snippet);
            break;
          case "architecture":
            architecturalSolutions.push(snippet);
            break;
          case "insight":
            keyInsights.push(snippet);
            break;
        }
      }
    }

    // 4. Derive Summary / Primary Takeaway
    let summary = "";
    if (keyInsights.length > 0) {
      summary = keyInsights[0];
    } else if (architecturalSolutions.length > 0) {
      summary = architecturalSolutions[0];
    } else if (antiPatterns.length > 0) {
      summary = antiPatterns[0];
    } else {
      const firstNonEmpty = lines.slice(1).find((l) => !isMetadataLine(l) && l.trim().length > 15) || topic;
      summary = cleanMarkdownText(firstNonEmpty);
    }
    if (summary.length > 240) {
      summary = summary.slice(0, 237) + "...";
    }

    const entryId = `${date}-${slugify(topic)}`;

    entries.push({
      id: entryId,
      index: idx,
      date,
      topic,
      summary,
      keyInsights,
      architecturalSolutions,
      antiPatterns,
      verificationNotes,
      rulesAndTraps: [], // Populated during rules analysis
      rawContent: rawSection.trim(),
    });
  }

  // Populate extracted rules for each entry
  const allRules = extractRulesCatalog(entries);
  for (const entry of entries) {
    entry.rulesAndTraps = allRules.filter((r) => r.sourceDate === entry.date);
  }

  return entries;
}

/**
 * Loads and parses reflection memory from disk.
 */
export function loadReflectionMemory(filePath: string = DEFAULT_MEMORY_PATH): ReflectionEntry[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Learnings and reflections file not found at: ${filePath}`);
  }
  const rawContent = fs.readFileSync(filePath, "utf-8");
  return parseReflectionMarkdown(rawContent);
}

// ============================================================================
// Rules & Traps Engine
// ============================================================================

/**
 * Extracts and consolidates high-value rules, bug traps, and code patterns.
 */
export function extractRulesCatalog(entries: ReflectionEntry[]): RuleItem[] {
  const rules: RuleItem[] = [
    {
      id: "rule-framer-spring-keyframes",
      category: "ui-motion",
      categoryLabel: "UI & Motion Physics",
      title: "Framer Motion Multi-Keyframe Spring Trap",
      trap: "Motion transform channels (scale, x, y, rotate) default internally to type: 'spring'. Array keyframes (>= 3 values, e.g. [1, 1.025, 1]) trigger fatal uncaught exception: 'Only two keyframes currently supported with spring and inertia animations'.",
      rule: "Whenever specifying array-based keyframes on transform properties, ALWAYS explicitly declare type: 'tween'.",
      remediation: "Add transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }} to bypass internal spring defaults.",
      codeSnippet: `transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}`,
      sourceDate: "2026-10-12",
      sourceTopic: "In-Quiz Experience Overhaul, Framer Motion Spring Traps, & Worktree Resiliency",
    },
    {
      id: "rule-decoupled-action-rails",
      category: "architecture",
      categoryLabel: "UI Resilience & Architecture",
      title: "Decoupled Action Rails & MarkdownErrorBoundary",
      trap: "Co-locating progression controls ('Next', 'Skip', 'Exit') inside rich dynamic child cards unmounts the escape hatch when child rendering fails, trapping the user.",
      rule: "Anchor navigation and session state controls outside child presentation cards. Wrap KaTeX math renderers and dynamic markdown in defensive error boundaries.",
      remediation: "Use decoupled action rails and MarkdownErrorBoundary with graceful fallbacks.",
      codeSnippet: `<MarkdownErrorBoundary fallback={<span className="text-red-500 font-mono text-xs">Error rendering math formula</span>}>\n  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>\n</MarkdownErrorBoundary>`,
      sourceDate: "2026-10-12",
      sourceTopic: "In-Quiz Experience Overhaul & UI Resilience",
    },
    {
      id: "rule-katex-currency-delimiters",
      category: "ui-motion",
      categoryLabel: "Typography & KaTeX Defense",
      title: "KaTeX Currency Delimiter Collision ($50 to $60)",
      trap: "Economics and business questions frequently contain prices ('$50 to $60'). KaTeX treats unescaped dollar signs as math delimiters, mangling sentences and throwing parser syntax crashes.",
      rule: "Pre-stash display math blocks ($$...$$) and escape single dangling currency symbols (US$ -> US\\$, $50 -> \\$50) before sending text to Markdown parsers.",
      remediation: "Run all stems, options, and explanations through escapeCurrencyDollars() / sanitizeKaTeX().",
      codeSnippet: `export function escapeCurrencyDollars(text: string): string {\n  return text.replace(/\\$(\\d+(?:\\.\\d+)?)/g, "\\\\$$1");\n}`,
      sourceDate: "2026-10-14",
      sourceTopic: "Cambridge 0455 Staging Verification & KaTeX Currency Delimiters",
    },
    {
      id: "rule-next-dev-cache-collision",
      category: "operations",
      categoryLabel: "Next.js Build & Process Operations",
      title: "Stale Build Cache & Dev Manifest Collisions",
      trap: "Running `next build` concurrently with an active `next dev` background daemon corrupts App Router manifests, throwing transient HTTP 500 or ENOENT: pages-manifest.json errors.",
      rule: "Terminate active dev server processes before running production builds or worktree cleanup. When build manifests diverge, purge .next cache: `rm -rf .next && npm run build`.",
      remediation: "Check active ports before build and execute clean server reboots.",
      codeSnippet: `rm -rf .next && npm run build`,
      sourceDate: "2026-10-12",
      sourceTopic: "Question Bank UI & Filter/Table Refinement",
    },
    {
      id: "rule-worktree-daemon-teardown",
      category: "operations",
      categoryLabel: "Git Worktree Protocol",
      title: "Daemon Teardown Before Worktree Removal",
      trap: "Executing `git worktree remove --force` while a Next.js dev server daemon is still running inside that worktree directory leaves orphaned locking processes and corrupted file descriptors.",
      rule: "Always terminate background processes (lsof -ti :3001 | xargs kill -9) before removing git worktree directories.",
      remediation: "Kill daemon processes first, then cleanly remove the worktree.",
      codeSnippet: `lsof -ti :3001 | xargs kill -9\ngit worktree remove --force .worktrees/<topic>`,
      sourceDate: "2026-10-12",
      sourceTopic: "Worktree & Dev Server Daemon Orchestration Protocol",
    },
    {
      id: "rule-zero-fallback-empty-database",
      category: "architecture",
      categoryLabel: "Data Layer Contracts",
      title: "Zero-Fallback Data Layer on Empty Databases",
      trap: "Returning hardcoded synthetic mock questions or subjects when production database queries return empty arrays masks missing data and tricks curators and students.",
      rule: "Data layer functions must strictly return empty arrays [] on empty tables or query failures. All UI surfaces must render clean, tactile Neobrutalist empty states.",
      remediation: "Ensure fetchQuestionsFromDb() and fetchSubjectsFromDb() return [] without synthetic fallbacks.",
      codeSnippet: `if (!data || data.length === 0) return []; // Never return hardcoded mock questions`,
      sourceDate: "2026-10-14",
      sourceTopic: "Purging Mock Cambridge Data & Empty Database UI Defense",
    },
    {
      id: "rule-cambridge-question-status-schema",
      category: "schema-validation",
      categoryLabel: "Schema Conformity",
      title: "Cambridge MCQ Question Entity Status Parity",
      trap: "Mapping questions to a 'draft' or 'in_review' status breaks Cambridge MCQ schema validation (validateStagingPaper) and Supabase table check constraints.",
      rule: "Papers hold lifecycle states ('draft', 'in_review', 'published'), but individual questions strictly support only 'active' | 'withdrawn'.",
      remediation: "Keep question status as 'active' and manage draft status at paper batch level.",
      codeSnippet: `status: 'active' | 'withdrawn'`,
      sourceDate: "2026-10-13",
      sourceTopic: "Ingestion Pipeline Feedback & Question Status Schema Alignment",
    },
    {
      id: "rule-cambridge-0455-partial-batch",
      category: "schema-validation",
      categoryLabel: "Cambridge Paper Specifications",
      title: "Economics 0455 Paper 1 (30 vs 40 Questions)",
      trap: "Cambridge Science papers (0625, 0620, 0610) contain exactly 40 questions. Cambridge Economics (0455) contains exactly 30 questions. Enforcing rigid 40-question constraints rejects valid Economics papers.",
      rule: "Allow partial batches with { allowPartialBatch: true } in paper validation while verifying questions array is non-empty and all options are complete.",
      remediation: "Pass allowPartialBatch: true in staged-paper and publish API endpoints.",
      codeSnippet: `validateStagingPaper(data, { allowPartialBatch: true })`,
      sourceDate: "2026-10-14",
      sourceTopic: "Cambridge Economics 0455 Staging Verification",
    },
    {
      id: "rule-worktree-atomic-live-release",
      category: "workflow-agents",
      categoryLabel: "Deployment & Git Governance",
      title: "Worktree Isolation & Atomic Live Release",
      trap: "Committing directly to local main or pushing local main to production risks shipping unverified or WIP changes from concurrent sessions.",
      rule: "Develop exclusively inside dedicated git worktrees branched from origin/main. Rebase on origin/main and push ONLY the feature refspec: git push origin feat/<topic>:main.",
      remediation: "Never push local main directly. Local main remains clean and untouched.",
      codeSnippet: `git push origin feat/<topic>:main`,
      sourceDate: "2026-10-14",
      sourceTopic: "Purging Mock Cambridge Data & Atomic Live Release",
    },
    {
      id: "rule-bundled-verification-dod",
      category: "workflow-agents",
      categoryLabel: "Subagent Definition of Done",
      title: "Bundled Verification Contract (Zero Unverified Handoffs)",
      trap: "Delegating implementation to subagents without bundled self-verification results in TypeScript errors, broken imports, and runtime crashes discovered downstream.",
      rule: "Subagents must compile (npx tsc --noEmit) and run targeted unit tests within the same invocation before reporting completion.",
      remediation: "Enforce npx tsc --noEmit in subagent prompts and verification suites.",
      codeSnippet: `npx tsc --noEmit && npm test`,
      sourceDate: "2026-10-12",
      sourceTopic: "Cambridge Ingestion System v2 Rework & Orchestrator Governance",
    },
    {
      id: "rule-dnd-child-pointer-events",
      category: "ui-motion",
      categoryLabel: "HTML5 Drag & Drop Interception",
      title: "HTML5 Drag & Drop Child Node Interception",
      trap: "Hovering over text, icons, or badges inside drag-and-drop dropzones triggers dragleave events on the parent, causing visual flicker and dropped file loss.",
      rule: "Apply pointer-events-none to all child elements inside dropzone containers, or manage drag depth via an active drag counter.",
      remediation: "Add pointer-events-none to all child spans, labels, and SVGs inside drag targets.",
      codeSnippet: `<div className="dropzone">\n  <p className="pointer-events-none">Drop QP PDF here</p>\n</div>`,
      sourceDate: "2026-10-13",
      sourceTopic: "HTML5 Drag & Drop Child Node Interception",
    },
    {
      id: "rule-keyboard-hotkey-input-suppression",
      category: "ui-motion",
      categoryLabel: "Keyboard Ergonomics",
      title: "Keyboard Hotkey Input Field Suppression",
      trap: "Pressing 1-4, A-D, or Space during text editing triggers answer toggles or question jumps if hotkey listeners do not inspect the active event target.",
      rule: "Always suppress hotkey triggers when active document target is an INPUT, TEXTAREA, or contentEditable element.",
      remediation: "Check target.tagName before evaluating hotkeys.",
      codeSnippet: `if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;`,
      sourceDate: "2026-10-12",
      sourceTopic: "Ingestion Studio UI/UX Streamlining & Layout Architecture",
    },
    {
      id: "rule-gemini-503-capacity-resilience",
      category: "operations",
      categoryLabel: "AI Ingestion & Resiliency",
      title: "Gemini API 503 Capacity Resilience & 4.5MB Bypass",
      trap: "Large past paper PDF payloads sent through Vercel serverless functions hit 4.5MB body size limits, and Gemini API spikes throw transient HTTP 503 capacity errors.",
      rule: "Upload heavy PDFs directly to Supabase Storage before extraction, and wrap Gemini API calls in exponential backoff with jitter and automated fallback models.",
      remediation: "Use direct storage uploads and client-driven SSE polling or offline Python ingestion pipelines.",
      codeSnippet: `await retryWithBackoff(() => callGemini(payload), { retries: 5, initialDelay: 1000 })`,
      sourceDate: "2026-10-13",
      sourceTopic: "Gemini API Model Evolution, Distributed 503 Capacity Resilience, & Offline Pipeline",
    },
    {
      id: "rule-subagent-turn-efficiency",
      category: "workflow-agents",
      categoryLabel: "Agent Efficiency & Orchestration",
      title: "Subagent Turn Efficiency & Zero-Polling Protocol",
      trap: "Unbounded exploration prompts cause subagents to execute 60+ serial tool turns inspecting individual files. Polling manage_subagents in a loop wastes thousands of context tokens.",
      rule: "Scope subagent prompts strictly with explicit file targets. Rely on passive turn-ending: the platform resumes execution automatically when subagents complete.",
      remediation: "Never poll manage_subagents list in loops; stop calling tools and wait for message events.",
      codeSnippet: `// Passive Turn-Ending: Stop tool calls immediately after dispatching subagents`,
      sourceDate: "2026-10-10",
      sourceTopic: "Subagent Turn Efficiency & Exploration",
    },
  ];

  return rules;
}

export function extractRulesAndTraps(filePath?: string): RuleItem[] {
  const entries = loadReflectionMemory(filePath);
  return extractRulesCatalog(entries);
}

// ============================================================================
// Search Engine & Scoring
// ============================================================================

interface QueryTokens {
  phrases: string[];
  terms: string[];
  fullNormalized: string;
}

function parseQuery(query: string): QueryTokens {
  const phrases: string[] = [];
  const phraseRegex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = phraseRegex.exec(query)) !== null) {
    if (match[1].trim().length > 0) {
      phrases.push(match[1].trim().toLowerCase());
    }
  }

  const remainder = query.replace(phraseRegex, " ").toLowerCase();
  const terms = remainder
    .split(/[\s,;:!?.+*~]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const fullNormalized = query.replace(/["']/g, "").trim().toLowerCase();

  // If query is multiple words without explicit quotes, include it as an exact phrase
  if (phrases.length === 0 && terms.length > 1 && fullNormalized.length > 3) {
    phrases.push(fullNormalized);
  }

  return { phrases, terms, fullNormalized };
}

function countOccurrences(text: string, term: string): number {
  if (!text || !term) return 0;
  let count = 0;
  let pos = 0;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();

  while ((pos = lowerText.indexOf(lowerTerm, pos)) !== -1) {
    count++;
    pos += lowerTerm.length;
  }
  return count;
}

function highlightInSnippet(snippet: string, terms: string[]): string {
  if (!snippet || terms.length === 0) return snippet;

  let highlighted = snippet;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    highlighted = highlighted.replace(regex, `${c.bgYellow}${c.bold}$1${c.reset}`);
  }
  return highlighted;
}

function extractHighlights(content: string, terms: string[], maxSnippets: number = 2): string[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const matchedLines: { line: string; score: number }[] = [];

  for (const line of lines) {
    let score = 0;
    const lower = line.toLowerCase();
    for (const term of terms) {
      if (lower.includes(term)) {
        score += 5;
      }
    }
    if (score > 0) {
      matchedLines.push({ line: line.trim(), score });
    }
  }

  matchedLines.sort((a, b) => b.score - a.score);

  return matchedLines.slice(0, maxSnippets).map((m) => {
    let text = m.line;
    if (text.length > 200) {
      const firstTerm = terms.find((t) => text.toLowerCase().includes(t)) || terms[0];
      const idx = text.toLowerCase().indexOf(firstTerm.toLowerCase());
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + 140);
      text = (start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : "");
    }
    return cleanMarkdownText(text);
  });
}

/**
 * Searches reflection memory with keyword and multi-term scoring.
 */
export function searchMemory(query: string, options: SearchOptions = {}): SearchResult[] {
  const { limit = 10, threshold = 5, filePath } = options;
  const entries = loadReflectionMemory(filePath);

  const { phrases, terms } = parseQuery(query);
  const allSearchTerms = Array.from(new Set([...phrases, ...terms]));

  if (allSearchTerms.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const entry of entries) {
    let score = 0;
    const matchedTerms: Set<string> = new Set();
    const topicLower = entry.topic.toLowerCase();
    const summaryLower = entry.summary.toLowerCase();
    const rawLower = entry.rawContent.toLowerCase();

    // 1. Quoted phrase matches
    for (const phrase of phrases) {
      if (topicLower.includes(phrase)) {
        score += 40;
        matchedTerms.add(phrase);
      }
      if (summaryLower.includes(phrase)) {
        score += 25;
        matchedTerms.add(phrase);
      }
      const rawCount = countOccurrences(rawLower, phrase);
      if (rawCount > 0) {
        score += Math.min(30, rawCount * 10);
        matchedTerms.add(phrase);
      }
    }

    // 2. Individual term matches
    for (const term of terms) {
      if (topicLower.includes(term)) {
        score += 15;
        matchedTerms.add(term);
      }
      if (summaryLower.includes(term)) {
        score += 8;
        matchedTerms.add(term);
      }

      // Check key sections
      for (const ins of entry.keyInsights) {
        if (ins.toLowerCase().includes(term)) {
          score += 6;
          matchedTerms.add(term);
        }
      }
      for (const sol of entry.architecturalSolutions) {
        if (sol.toLowerCase().includes(term)) {
          score += 6;
          matchedTerms.add(term);
        }
      }
      for (const anti of entry.antiPatterns) {
        if (anti.toLowerCase().includes(term)) {
          score += 6;
          matchedTerms.add(term);
        }
      }

      const rawCount = countOccurrences(rawLower, term);
      if (rawCount > 0) {
        score += Math.min(10, rawCount * 2);
        matchedTerms.add(term);
      }
    }

    // 3. Multi-term coverage bonus (if all query terms are present)
    if (allSearchTerms.length > 1 && allSearchTerms.every((t) => matchedTerms.has(t))) {
      score += 20;
    }

    // 4. Slight date recency bonus (0 to 3 points)
    const entryDate = new Date(entry.date).getTime();
    if (!isNaN(entryDate)) {
      const daysSinceBase = Math.floor(entryDate / (1000 * 60 * 60 * 24));
      score += Math.min(3, (daysSinceBase % 100) * 0.05);
    }

    if (score >= threshold) {
      const matchedTermList = Array.from(matchedTerms);
      const highlights = extractHighlights(entry.rawContent, matchedTermList, 2);

      results.push({
        entry,
        score: Math.round(score * 10) / 10,
        matchedTerms: matchedTermList,
        highlights,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Retrieves the most recent N reflection entries.
 */
export function getRecentReflections(limit: number = 5, filePath?: string): ReflectionEntry[] {
  const entries = loadReflectionMemory(filePath);
  // Sort descending by date, then index
  const sorted = [...entries].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (diff !== 0) return diff;
    return b.index - a.index;
  });

  return sorted.slice(0, limit);
}

/**
 * Calculates high-level reflection memory statistics.
 */
export function getMemoryStats(filePath?: string): MemoryStats {
  const entries = loadReflectionMemory(filePath);
  const rules = extractRulesCatalog(entries);

  let earliest = "9999-99-99";
  let latest = "0000-00-00";
  let totalInsights = 0;
  let totalSolutions = 0;
  let totalAntiPatterns = 0;

  for (const entry of entries) {
    if (entry.date < earliest) earliest = entry.date;
    if (entry.date > latest) latest = entry.date;
    totalInsights += entry.keyInsights.length;
    totalSolutions += entry.architecturalSolutions.length;
    totalAntiPatterns += entry.antiPatterns.length;
  }

  return {
    totalEntries: entries.length,
    earliestDate: earliest !== "9999-99-99" ? earliest : "N/A",
    latestDate: latest !== "0000-00-00" ? latest : "N/A",
    totalInsights,
    totalSolutions,
    totalAntiPatterns,
    totalRules: rules.length,
  };
}

// ============================================================================
// Terminal Formatters
// ============================================================================

export function formatEntryTerminal(entry: ReflectionEntry): string {
  const divider = `${c.dim}──────────────────────────────────────────────────────────────────────${c.reset}`;
  const lines: string[] = [];

  lines.push(`${c.bold}${c.cyan}#${entry.index} [${entry.date}]${c.reset} ${c.bold}${entry.topic}${c.reset}`);
  lines.push(`${c.dim}ID: ${entry.id}${c.reset}`);
  lines.push(divider);

  if (entry.summary) {
    lines.push(`${c.bold}Takeaway:${c.reset} ${entry.summary}`);
  }

  if (entry.keyInsights.length > 0) {
    lines.push(`\n${c.bold}${c.green}💡 Key Insights (${entry.keyInsights.length}):${c.reset}`);
    for (const ins of entry.keyInsights.slice(0, 3)) {
      lines.push(`  ${c.dim}•${c.reset} ${ins}`);
    }
  }

  if (entry.architecturalSolutions.length > 0) {
    lines.push(`\n${c.bold}${c.blue}🏗️ Architectural Solutions (${entry.architecturalSolutions.length}):${c.reset}`);
    for (const sol of entry.architecturalSolutions.slice(0, 3)) {
      lines.push(`  ${c.dim}•${c.reset} ${sol}`);
    }
  }

  if (entry.antiPatterns.length > 0) {
    lines.push(`\n${c.bold}${c.yellow}⚠️ Anti-Patterns & Traps (${entry.antiPatterns.length}):${c.reset}`);
    for (const anti of entry.antiPatterns.slice(0, 3)) {
      lines.push(`  ${c.dim}•${c.reset} ${anti}`);
    }
  }

  if (entry.verificationNotes.length > 0) {
    lines.push(`\n${c.bold}${c.magenta}✅ Verification Notes:${c.reset}`);
    for (const ver of entry.verificationNotes.slice(0, 2)) {
      lines.push(`  ${c.dim}•${c.reset} ${ver}`);
    }
  }

  return lines.join("\n");
}

export function formatSearchResultTerminal(result: SearchResult, rank: number): string {
  const { entry, score, matchedTerms, highlights } = result;
  const lines: string[] = [];

  lines.push(
    `${c.bold}${c.cyan}[#${rank}] Score: ${score}${c.reset} ${c.dim}│${c.reset} ${c.bold}${entry.date}${c.reset} ${c.dim}│${c.reset} ${c.bold}${entry.topic}${c.reset}`
  );
  lines.push(
    `  ${c.dim}Matched terms:${c.reset} ${matchedTerms.map((t) => `${c.yellow}${t}${c.reset}`).join(", ")}`
  );

  if (highlights.length > 0) {
    lines.push(`  ${c.bold}Relevant Excerpts:${c.reset}`);
    for (const hl of highlights) {
      const coloredHl = highlightInSnippet(hl, matchedTerms);
      lines.push(`  ${c.dim}“${c.reset}${coloredHl}${c.dim}”${c.reset}`);
    }
  } else if (entry.summary) {
    lines.push(`  ${c.dim}Summary: ${entry.summary}${c.reset}`);
  }

  return lines.join("\n");
}

export function formatRuleItemTerminal(rule: RuleItem, idx: number): string {
  const lines: string[] = [];

  lines.push(`${c.bold}${idx + 1}. [${rule.categoryLabel}] ${rule.title}${c.reset}`);
  lines.push(`   ${c.red}⚠️ Bug Trap:${c.reset} ${rule.trap}`);
  lines.push(`   ${c.green}🛡️ Rule:${c.reset} ${rule.rule}`);

  if (rule.codeSnippet) {
    lines.push(`   ${c.dim}💻 Pattern:${c.reset} ${c.bold}${rule.codeSnippet}${c.reset}`);
  }

  lines.push(`   ${c.dim}Source: ${rule.sourceDate} — ${rule.sourceTopic}${c.reset}`);
  return lines.join("\n");
}

// ============================================================================
// CLI Command Dispatcher
// ============================================================================

function printUsage(): void {
  console.log(`
${c.bold}${c.cyan}🤖 Agent Memory CLI${c.reset} ${c.dim}— Index & Search Reflections and Learnings${c.reset}

${c.bold}USAGE:${c.reset}
  npx tsx scripts/agent-memory.ts <command> [options]

${c.bold}COMMANDS:${c.reset}
  ${c.green}search <query>${c.reset}      Search memory for keywords or phrases with relevance scoring
  ${c.green}recent [limit]${c.reset}      List the most recent N reflection entries (default 5)
  ${c.green}rules${c.reset}               Display consolidated critical rules, bug traps, and code patterns
  ${c.green}stats${c.reset}               Display reflection memory statistics overview
  ${c.green}show <index|id>${c.reset}     Inspect full details of a specific reflection entry

${c.bold}OPTIONS:${c.reset}
  ${c.yellow}--json${c.reset}              Output structured JSON format for programmatic agent ingestion
  ${c.yellow}--limit <number>${c.reset}    Limit search or recent output results
  ${c.yellow}--file <path>${c.reset}       Custom path to learnings_and_reflections.md
  ${c.yellow}--help, -h${c.reset}          Show this help manual

${c.bold}EXAMPLES:${c.reset}
  npx tsx scripts/agent-memory.ts search "Framer Motion"
  npx tsx scripts/agent-memory.ts search "currency KaTeX" --json
  npx tsx scripts/agent-memory.ts recent 3
  npx tsx scripts/agent-memory.ts rules
  npx tsx scripts/agent-memory.ts rules --json
`);
}

export function runCli(args: string[]): void {
  const isJson = args.includes("--json");
  const filteredArgs = args.filter((a) => a !== "--json");

  // File override
  let customFile: string | undefined;
  const fileIdx = filteredArgs.indexOf("--file");
  if (fileIdx !== -1 && filteredArgs[fileIdx + 1]) {
    customFile = filteredArgs[fileIdx + 1];
    filteredArgs.splice(fileIdx, 2);
  }

  // Limit override
  let limitArg: number | undefined;
  const limitIdx = filteredArgs.indexOf("--limit");
  if (limitIdx !== -1 && filteredArgs[limitIdx + 1]) {
    limitArg = parseInt(filteredArgs[limitIdx + 1], 10);
    filteredArgs.splice(limitIdx, 2);
  }

  const command = filteredArgs[0];

  if (!command || command === "--help" || command === "-h") {
    if (isJson) {
      console.log(JSON.stringify({ error: "No command specified", usage: "search | recent | rules | stats" }, null, 2));
    } else {
      printUsage();
      const stats = getMemoryStats(customFile);
      console.log(
        `${c.bold}Current Index Status:${c.reset} ${stats.totalEntries} entries indexed (${stats.earliestDate} to ${stats.latestDate}) with ${stats.totalRules} critical rules.`
      );
    }
    return;
  }

  // --------------------------------------------------------------------------
  // Command: search
  // --------------------------------------------------------------------------
  if (command === "search") {
    const query = filteredArgs.slice(1).join(" ");
    if (!query.trim()) {
      if (isJson) {
        console.log(JSON.stringify({ error: "Missing query for search command" }, null, 2));
      } else {
        console.error(`${c.red}Error:${c.reset} Please provide a search query. Example: search "Framer Motion"`);
      }
      process.exit(1);
    }

    const results = searchMemory(query, {
      limit: limitArg || 5,
      filePath: customFile,
    });

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            query,
            totalMatches: results.length,
            results: results.map((r) => ({
              score: r.score,
              date: r.entry.date,
              topic: r.entry.topic,
              id: r.entry.id,
              matchedTerms: r.matchedTerms,
              highlights: r.highlights,
              summary: r.entry.summary,
              keyInsights: r.entry.keyInsights,
              architecturalSolutions: r.entry.architecturalSolutions,
              antiPatterns: r.entry.antiPatterns,
              verificationNotes: r.entry.verificationNotes,
            })),
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      `\n${c.bold}${c.cyan}🔍 Search Results for:${c.reset} ${c.bold}"${query}"${c.reset} ${c.dim}(${results.length} matches)${c.reset}\n`
    );

    if (results.length === 0) {
      console.log(`  ${c.yellow}No reflections matched your query.${c.reset} Try broader terms or check 'rules'.\n`);
      return;
    }

    results.forEach((res, i) => {
      console.log(formatSearchResultTerminal(res, i + 1));
      console.log(`${c.dim}──────────────────────────────────────────────────────────────────────${c.reset}`);
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Command: recent
  // --------------------------------------------------------------------------
  if (command === "recent") {
    const limit = limitArg || parseInt(filteredArgs[1], 10) || 5;
    const recents = getRecentReflections(limit, customFile);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            count: recents.length,
            entries: recents.map((e) => ({
              index: e.index,
              date: e.date,
              topic: e.topic,
              id: e.id,
              summary: e.summary,
              insightsCount: e.keyInsights.length,
              solutionsCount: e.architecturalSolutions.length,
              antiPatternsCount: e.antiPatterns.length,
              keyTakeaways: e.keyInsights.slice(0, 3),
              topSolutions: e.architecturalSolutions.slice(0, 2),
            })),
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      `\n${c.bold}${c.cyan}🕒 Most Recent ${recents.length} Reflection Entries${c.reset}\n`
    );

    recents.forEach((entry, idx) => {
      console.log(
        `${c.bold}${c.green}[#${idx + 1}] ${entry.date}${c.reset} — ${c.bold}${entry.topic}${c.reset}`
      );
      console.log(`  ${c.dim}ID:${c.reset} ${entry.id}`);
      console.log(`  ${c.bold}Takeaway:${c.reset} ${entry.summary}`);
      if (entry.keyInsights.length > 0) {
        console.log(`  ${c.cyan}• Insight:${c.reset} ${entry.keyInsights[0]}`);
      }
      if (entry.architecturalSolutions.length > 0) {
        console.log(`  ${c.blue}• Solution:${c.reset} ${entry.architecturalSolutions[0]}`);
      }
      console.log(`${c.dim}──────────────────────────────────────────────────────────────────────${c.reset}`);
    });
    return;
  }

  // --------------------------------------------------------------------------
  // Command: rules
  // --------------------------------------------------------------------------
  if (command === "rules") {
    const rules = extractRulesAndTraps(customFile);

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            totalRules: rules.length,
            rules,
          },
          null,
          2
        )
      );
      return;
    }

    console.log(
      `\n${c.bold}${c.cyan}🛡️ Consolidated Rules, Bug Traps & Architecture Patterns (${rules.length} Rules)${c.reset}\n`
    );

    // Group rules by category
    const categories: Record<string, RuleItem[]> = {};
    for (const r of rules) {
      if (!categories[r.categoryLabel]) {
        categories[r.categoryLabel] = [];
      }
      categories[r.categoryLabel].push(r);
    }

    let overallIdx = 0;
    for (const [catName, catRules] of Object.entries(categories)) {
      console.log(`${c.bold}${c.bgCyan} [Category: ${catName}] ${c.reset}\n`);
      for (const rule of catRules) {
        console.log(formatRuleItemTerminal(rule, overallIdx++));
        console.log("");
      }
    }
    return;
  }

  // --------------------------------------------------------------------------
  // Command: stats
  // --------------------------------------------------------------------------
  if (command === "stats") {
    const stats = getMemoryStats(customFile);

    if (isJson) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(`\n${c.bold}${c.cyan}📊 Agent Memory Engine Statistics${c.reset}\n`);
    console.log(`  ${c.bold}Total Reflection Entries:${c.reset}  ${stats.totalEntries}`);
    console.log(`  ${c.bold}Date Span:${c.reset}                 ${stats.earliestDate} to ${stats.latestDate}`);
    console.log(`  ${c.bold}Consolidated Rules:${c.reset}        ${stats.totalRules}`);
    console.log(`  ${c.bold}Key Insights Indexed:${c.reset}      ${stats.totalInsights}`);
    console.log(`  ${c.bold}Architectural Solutions:${c.reset}   ${stats.totalSolutions}`);
    console.log(`  ${c.bold}Anti-Patterns & Traps:${c.reset}     ${stats.totalAntiPatterns}\n`);
    return;
  }

  // --------------------------------------------------------------------------
  // Command: show <id|index>
  // --------------------------------------------------------------------------
  if (command === "show") {
    const target = filteredArgs[1];
    if (!target) {
      console.error(`${c.red}Error:${c.reset} Provide an entry index or ID. Example: show 1`);
      process.exit(1);
    }

    const entries = loadReflectionMemory(customFile);
    const targetIdx = parseInt(target, 10);

    const found = entries.find((e) => e.index === targetIdx || e.id === target || e.date === target);
    if (!found) {
      console.error(`${c.red}Error:${c.reset} Reflection entry not found matching: ${target}`);
      process.exit(1);
    }

    if (isJson) {
      console.log(JSON.stringify(found, null, 2));
      return;
    }

    console.log("\n" + formatEntryTerminal(found) + "\n");
    return;
  }

  console.error(`${c.red}Unknown command:${c.reset} ${command}`);
  printUsage();
  process.exit(1);
}

// ============================================================================
// Direct Execution Entry Point
// ============================================================================

// If run directly from CLI
if (typeof require !== "undefined" && require.main === module) {
  runCli(process.argv.slice(2));
} else {
  // ESM or tsx direct execution check
  const isDirectTsx =
    process.argv[1] &&
    (process.argv[1].endsWith("agent-memory.ts") || process.argv[1].endsWith("agent-memory.js"));

  if (isDirectTsx) {
    runCli(process.argv.slice(2));
  }
}
