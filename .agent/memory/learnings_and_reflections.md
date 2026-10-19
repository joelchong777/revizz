# Learnings and Reflections — Consolidated Fast-Boot Digest

> High-density architectural knowledge base, active bug traps, and system invariants for Revizz. Query via `npm run memory` or read in a single `<120`-line slice. Historical verbose logs archived in `.agent/memory/archive/learnings_archive_2026_10.md`.

## Active Architectural Rules & Bug Traps (Quick Reference)

| # | Domain | Rule & Bug Trap Summary | Defense Pattern |
|---|---|---|---|
| 1 | React 19 Hooks | **No Conditional Hooks (React #310)**: Early returns before `useMemo`/`useCallback` corrupt Hook order. | Place all hooks unconditionally at top of component. |
| 2 | Test Runner | **No `.tsx` imports in `verify-revizz.ts` (TS6142)**: `tsc` commonjs compilation fails on tsx helpers. | Decouple pure TS utilities or run via `tsx`. |
| 3 | Framer Motion | **>=3 Keyframes require `type: "tween"`**: Motion springs throw fatal uncaught exceptions on arrays. | Explicitly pass `transition={{ type: "tween", duration: 0.3 }}`. |
| 4 | Typography | **KaTeX Currency Escaping (\$50 to \$60)**: Prices collide with KaTeX math delimiters and crash parsers. | Pre-stash display math and escape dangling dollars: `\$50`. |
| 5 | Markdown Tables | **GFM Table Rendering**: Markdown tables require plugins and responsive wrappers. | Use `remarkGfm` + `rehypeRaw` with `overflow-x-auto rounded-xl border-2`. |
| 6 | CDN Storage | **`resolveDiagramUrl()` for Supabase CDN**: Diagram filenames require signed/public bucket resolution. | Resolve storage path to `question-diagrams` public CDN URL. |
| 7 | Data Layer | **Zero-Fake-Data Invariant**: Synthetic mock fallbacks mask missing DB data and deceive curators. | Return `[]` on empty queries; verified by `verify-fake-data-purge.ts`. |
| 8 | Mobile Ergonomics| **Solid Header & Grid Button Defense**: Transparent headers bleed on scroll; mobile buttons clip. | Use solid `bg-bg` on sticky Header and `grid-cols-2 sm:grid-cols-4`. |
| 9 | Gamification | **Demo Review Pile Lock**: Demo sessions must never overwrite persistent Leitner review piles. | Guard review pile writes with `!isDemo` session check. |
| 10 | Git Worktree | **Worktree Staging Isolation**: Symlinking `staging/` between worktrees causes cross-branch clobbering. | Keep staging JSON isolated; never symlink mutable data dirs. |
| 11 | UI Architecture | **Decoupled Action Rails**: Navigation controls unmount when dynamic child questions crash. | Anchor next/skip rails outside dynamic question cards. |
| 12 | Next.js Dev | **Stale Manifest Collisions**: Concurrent `next dev` and `next build` corrupt `.next` cache. | Kill active dev server on port 3000 before running production build. |
| 13 | Multi-Agent | **Bundled Verification DoD**: Subagents must compile and test before reporting completion. | Run `npx tsc --noEmit && npm test` inside subagent turn. |
| 14 | Drag & Drop | **D&D Pointer Events Interception**: Child nodes trigger `dragleave` on dropzone container. | Apply `pointer-events-none` to all dropzone children. |
| 15 | Keyboard A11y | **Hotkey Input Suppression**: 1-4/A-D/Space shortcuts trigger during text editing. | Check `['INPUT', 'TEXTAREA'].includes(e.target.tagName)` before fire. |
| 16 | CI/CD Deployment | **Instant HTTP Probe False-Positive**: Checking production URL immediately after git push returns cached prior deployment. | Enforce direct Vercel CLI execution (`npx vercel --prod --yes`) or poll status for `● Ready`. |
| 17 | Package Dependencies | **Local Cache Dependency Masking**: Locally cached `node_modules` hides missing `package.json` entries (`rehype-raw`, `remark-gfm`). | Validate dependencies directly in `package.json` against imports before shipping. |
| 18 | Data Tables | **Multi-Format Table Detection**: Checking only `stem.includes('\|')` skips Cambridge questions with diagram/text tables. | Inspect stem phrasing, HTML tags, option matrices, and diagram metadata. |
| 19 | UI Layout | **Viewport-Height Drawer Stretch**: Using `h-[calc(100vh-...)]` and `flex-1` with `mt-auto` creates dead space when inner lists are removed. | Enforce `shrink-0` and content-hugging card containers without artificial viewport constraints. |
| 20 | Vercel Deployment | **Vercel CLI Root Folder Stale Upload**: `npx vercel --prod` runs from repo root, deploying an older snapshot if root hasn't pulled `origin/main`. | Fast-forward root repo (`git pull --ff-only origin main`) immediately after atomic push in `scripts/wt.ts`. |

## Recent Session Reflection — 2026-10-19: Teacher Portal Overview Hub & Deployment Sync
- **Topic**: Teacher Portal Overview Command Center (`TeacherOverviewHub.tsx`) & Deployment Synchronization
- **Target Surfaces**: `components/portal/TeacherOverviewHub.tsx`, `app/portal/page.tsx`, `scripts/wt.ts`

### Architectural Solutions & Key Insights
- **Overview Command Center Architecture**: Built `components/portal/TeacherOverviewHub.tsx` featuring 4 tactile health cards (Accuracy, Turn-in rate, Test count, Triage flags), Test Compiler quick presets (10-Q diagnostic, 20-Q mock), homework completion progress bars with instant nudges, and a student triage hub (high errors, inactivity, fast guessing) with 1-click recovery pack assignments.
- **Revizz 3D Neobrutalist Physics Formula**: Standardized button motion across the dashboard to `shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-75` and strict Revizz color tokens (`#ffe1d0`, `#ccdbb2`, `#fed7aa`, `#fde8e8`, `#f9f4ed`, `#201e1d`).
- **Mobile Modal Defense**: Fixed Quick Diagnostic generator modal overflow by pinning header/footer and making the body scrollable (`max-h-[90vh] overflow-y-auto`).
- **Deployment Synchronization Safeguard**: Patched `scripts/wt.ts` `commandShip` to fast-forward `repoRoot` via `git pull --ff-only origin main` right after pushing to GitHub, preventing Vercel CLI uploads from deploying stale local repository snapshots.

### Verification & Quality Assurance
- Passed full TypeScript typecheck (`npx tsc --noEmit`) and all 158 tests in `npm test`. Verified live in production at `https://revizz-sand.vercel.app/portal?guest=true` (`HTTP 200`).
