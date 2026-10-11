# Learnings and Reflections

## Reflection Log Entry - 2026-10-10

1. **Incident**: Next.js 15 build failure `ENOENT: pages-manifest.json` after introducing new App Router routes.
2. **Root Cause**: Stale build artifacts in the local `.next` cache directory prior to clean compilation.
3. **Solution**: Purging `.next` prior to production build (`rm -rf .next && npm run build`) resolves transient pages-manifest missing descriptor errors in Next.js 15 App Router.
4. **Key Takeaways for Test Compiler Feature**:
   - Use CSS Paged Media (`@page`, `break-inside: avoid`) for printable past paper tests rather than client-side canvas rasterization to maintain 300+ DPI vector font sharpness and KaTeX equations.
   - Vector Code 128 barcodes can be rendered via pure SVG `<rect>` elements without external heavy dependencies.

## Reflection Log Entry - 2026-10-10 (Subagent Turn Efficiency & Exploration)

- **Date**: 2026-10-10
- **Issue**: Repository inspection took ~7 minutes (60+ serial tool turns by subagent).
- **Root Cause**: Unbounded exploration prompt caused the subagent to serially inspect dozens of individual files and directories (including historical archives and staging batches) across 60+ turns.
- **Optimization Protocol**:
  1. Scope subagent prompts strictly with explicit file targets and bounded search depths.
  2. Use single-shot batch bash commands (`find`, `grep`, `head`) instead of iterative sequential `view_file` calls.
  3. Parallelize independent sub-tasks across concurrent subagents (up to 10) instead of running a single monolithic serial subagent.
  4. Enforce strict exit conditions in subagent prompts to stop once primary objectives are met.

## Reflection Log Entry - 2026-10-11 (Question Bank Overhaul & Quick-Inspect Preview Drawer)

- **Date**: 2026-10-11
- **Feature**: Question Bank Overhaul & Quick-Inspect Preview Drawer
- **Key Architectural Patterns**:
  1. **Split-pane extraction**: Extracting `QuestionBankView.tsx` and `QuestionQuickPreviewDrawer.tsx` from monolithic `AdminTools.tsx` drastically improved modularity and component maintainability.
  2. **Zero-latency Preview**: Inline slide-out drawer with keyboard cycling (Arrow keys, Escape) avoids costly route hops to the full editor while providing immediate access to LaTeX math rendering, distractor reasoning, and diagrams.
  3. **Staged Data Enrichment**: Augmenting static questions with staged JSON data (`staging/0455_s24_12.json`) enables full step-by-step syllabus explanations and distractor analysis without blocking on remote database seeding.
  4. **3D Neobrutalist Filter Architecture**: Composing multi-dimensional filters (Paper, Session, Topic, Difficulty, Status, Diagram) with reactive counter badges and floating batch action drawer.
