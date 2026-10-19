# Learnings and Reflections — Consolidated Fast-Boot Digest

> High-density architectural knowledge base, active bug traps, and system invariants for Revizz. Query via `npm run memory` or read in a single `<220`-line slice. Historical verbose logs archived in `.agent/memory/archive/learnings_archive_2026_10.md`.

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
| 12 | Next.js Dev | **Stale Manifest Collisions**: Concurrent `next dev` and `next build` corrupt `.next` cache. | Kill active dev server on port 3001 before running production build. |
| 13 | Multi-Agent | **Bundled Verification DoD**: Subagents must compile and test before reporting completion. | Run `npx tsc --noEmit && npm test` inside subagent turn. |
| 14 | Drag & Drop | **D&D Pointer Events Interception**: Child nodes trigger `dragleave` on dropzone container. | Apply `pointer-events-none` to all dropzone children. |
| 15 | Keyboard A11y | **Hotkey Input Suppression**: 1-4/A-D/Space shortcuts trigger during text editing. | Check `['INPUT', 'TEXTAREA'].includes(e.target.tagName)` before fire. |
| 16 | CI/CD Deployment | **Instant HTTP Probe False-Positive**: Checking production URL immediately after git push returns cached prior deployment. | Enforce direct Vercel CLI execution (`npx vercel --prod --yes`) or poll status for `● Ready`. |
| 17 | Package Dependencies | **Local Cache Dependency Masking**: Locally cached `node_modules` hides missing `package.json` entries (`rehype-raw`, `remark-gfm`). | Validate dependencies directly in `package.json` against imports before shipping. |

## Reflection Log Entry - 2026-10-19 (Student UI, Auth Gate, 4-Option Format Filter, GFM Tables & Mobile Ergonomics)
- **Topic**: Student UI, Auth Gate, 4-Option Format Filter, GFM Tables & Mobile Ergonomics
- **Target Surfaces**: `components/Header.tsx`, `components/StudentAuthGate.tsx`, `components/StartFlow.tsx`, `components/QuestionCard.tsx`, `components/RoundSummary.tsx`, `components/TopicMasteryList.tsx`, `components/profile/StudentSettingsPanel.tsx`

### Architectural Solutions & Key Insights
- **Header & Navigation Isolation Pattern**: `Header.tsx` renders clean single-row `[REVIZZ] ── [Mute] [User]` with solid `bg-bg` sticky container, completely eliminating header scroll bleed and stripping all teacher/admin portal links from student views.
- **Student Auth Gate Defense & Demo Lock**: `StudentAuthGate.tsx` guards student accounts, protecting Leitner spaced repetition review piles from demo-session state corruption.
- **4-Option Question Format Filter Engine**: `StartFlow.tsx` provides 4 tactile pill buttons (`🔀 All`, `📈 Graph`, `📊 Diagram`, `📝 Text`) backed by `isGraphQuestion()` keyword heuristics and `isDiagramQuestion()` image checks in `lib/questions.ts`.
- **GFM Table & KaTeX Integration Pipeline**: `QuestionCard.tsx` and `RoundSummary.tsx` render rich Markdown tables via `remark-gfm` + `rehype-raw` inside responsive neobrutalist containers (`overflow-x-auto border-2 border-text shadow-offset-2`).
- **Tactile Feedback & CTAs System**: `QuestionCard.tsx` includes top citation pill, `correct-answer-banner`, `correct-option-pill`, and an immediate first-try next-question CTA popup.
- **Mobile Ergonomics Layout Defense**: `StudentSettingsPanel.tsx` enforces `grid-cols-2 sm:grid-cols-4` for round length buttons, preventing touch target crowding on small screens.

### Anti-Patterns & Bug Traps
- **React Hook Reordering Bug Trap (Error #310)**: Placing hooks below conditional session checks triggers fatal render crashes; hooks must execute unconditionally.
- **Header Transparency Bleed Bug Trap**: Using transparent or backdrop-blur headers allows quiz cards to bleed underneath during fast scrolling; enforce solid `bg-bg`.

### Verification & Quality Assurance
- Validated via `npx tsx scripts/verify-diagram-filter.ts` (100% filter accuracy) and `npx tsx scripts/verify-quiz-tables.ts` (GFM table render compliance).

## Reflection Log Entry - 2026-10-19 (Teacher Portal, Question Bank 100-Row Table, Multi-Topic Test Compiler & A4 Print)
- **Topic**: Teacher Portal, Question Bank 100-Row Table, Multi-Topic Test Compiler & A4 Print
- **Target Surfaces**: `components/admin/AdminTools.tsx`, `components/compiler/TestCompilerHub.tsx`, `components/compiler/PrintableExamLayout.tsx`, `lib/portal/bankFilters.ts`, `lib/compilerFilters.ts`

### Architectural Solutions & Key Insights
- **Dual Portal Modes & 100-Row Question Bank Pattern**: `AdminTools.tsx` supports `portalMode: 'teacher' | 'admin'` with 100-row pagination, 3-column teacher layout vs 5-column admin layout, and instant search/filter via `lib/portal/bankFilters.ts`.
- **Diagram Preview & CDN Lightbox System**: Integrated `resolveDiagramUrl()` with `CompilerDiagramPreview` for instant hover thumbnails and full-resolution modal inspection.
- **Multi-Topic Test Compiler Engine**: `TestCompilerHub.tsx` supports multiple topic selection (`topicIds: string[]`), automated test presets (Quick Quiz, Topic Test, Full Exam), and citation tag pills via `parseCitationTagPills()`.
- **A4 Print Engine & Bubble Sheet Layout**: `PrintableExamLayout.tsx` implements strict A4 `@page` geometry, `breakInside: 'avoid'` CSS cards, a compact 1-page 4-column bubble answer sheet, and teacher mark scheme explanation toggles.

### Anti-Patterns & Bug Traps
- **Print Pagination Break Trap**: Questions splitting across page breaks during printing; fixed with `break-inside-avoid-page` container CSS.
- **Missing Diagram CDN Trap**: Unresolved relative paths breaking print layouts; solved via centralized CDN URL resolution.

### Verification & Quality Assurance
- Compiler filters and print layouts tested against 100-question multi-topic papers; verify zero CSS overflows on A4 print previews.

## Reflection Log Entry - 2026-10-19 (App Admin Console, User Management CRUD API, 6-Panel Settings Hub & Ingestion Studio)
- **Topic**: App Admin Console, User Management CRUD API, 6-Panel Settings Hub & Ingestion Studio
- **Target Surfaces**: `components/admin/UserManagementHub.tsx`, `app/api/admin/users/route.ts`, `components/admin/AdminSettingsHub.tsx`, `lib/ingestion/markSchemeRemediator.ts`, `scripts/verify-fake-data-purge.ts`

### Architectural Solutions & Key Insights
- **User Management CRUD API System**: `/api/admin/users` coordinates full CRUD operations across `public.profiles` and `public.roster_invites`, featuring instant email validation and hybrid invite link / mailto generator.
- **Tactile Admin Console Workflow**: `UserManagementHub.tsx` provides real-time search, role switching (`student` ↔ `teacher` ↔ `admin`), campus account toggling (`is_school_account`), and 1-click CSV directory export.
- **6-Panel Settings Hub Setup**: `AdminSettingsHub.tsx` organizes configurations into deep-linkable tabs (`?tab=settings&sub=<school|system|ingestion|gameplay|auth|portal-menu>`).
- **Zero-Fake-Data Invariant Defense**: Strictly purged all synthetic mock fallbacks; database queries return clean empty arrays `[]` on empty tables, verified by `scripts/verify-fake-data-purge.ts`.
- **Ingestion Studio & 3-Way Auto-Remediator Engine**: `/admin?tab=ingestion` features `max-w-[1800px]` workspace, 3-way Mark Scheme validator (`lib/ingestion/markSchemeRemediator.ts`), and Cambridge syllabus tolerance (`0455` Economics = 30 MCQs; Sciences = 40 MCQs).

### Anti-Patterns & Bug Traps
- **Rigid Batch Size Constraint Trap**: Enforcing 40-question constraints rejects valid 30-question Cambridge Economics papers; use `allowPartialBatch: true`.
- **Mock Fallback Anti-Pattern**: Hardcoded mock question data masks empty database states; return empty arrays and display clean empty UI cards.

### Verification & Quality Assurance
- Automated verification via `npx tsx scripts/verify-fake-data-purge.ts` (0 fake items found) and Ingestion Studio 3-way schema reconciler tests.

## Reflection Log Entry - 2026-10-19 (Multi-Agent Tooling: Fast Worktree CLI, Codebase Atlas, Local Server & 1-Command Ship)
- **Topic**: Multi-Agent Tooling: Fast Worktree CLI, Codebase Atlas, Local Server & 1-Command Ship
- **Target Surfaces**: `scripts/wt.ts`, `scripts/codebase-map.ts`, `.agent/CODEBASE_MAP.md`, `scripts/agent-memory.ts`, `.agent/skills/`

### Architectural Solutions & Key Insights
- **Codebase Atlas Symbol Indexing Engine**: Generated `.agent/CODEBASE_MAP.md` indexes all symbols and exact file line coordinates (`L<start>-L<end>`), enabling zero-discovery agent injection without expensive filesystem grep loops.
- **Worktree CLI Orchestration System**: `scripts/wt.ts` provides complete worktree management: `create <topic>`, `serve <topic>` (port 3001), `stop`, `verify`, `ship <topic> -m "<msg>"`, and `clean <topic>`.
- **Atomic Live Release Deployment Protocol**: Agents develop in isolated `.worktrees/<topic>` branched from `origin/main`. `ship` rebases on latest `origin/main` and pushes exclusively `git push origin feat/<topic>:main`, preventing unverified local commits from leaking into production.
- **Fast Memory Retrieval Engine Solution**: `scripts/agent-memory.ts` indexes this consolidated digest in `<20ms`, supporting `npm run memory -- recent 4`, `rules`, and full-text keyword searches.

### Anti-Patterns & Bug Traps
- **Orphaned Background Daemon Trap**: Deleting a worktree while `next dev` runs on port 3001 leaves locked socket descriptors; `npm run wt stop` kills processes first.
- **Direct Local Main Commit Anti-Pattern**: Committing to local `main` risks cross-agent collisions; worktrees ensure complete branch isolation.

### Verification & Quality Assurance
- Full build and test validation via `npm run wt verify` (`npx tsc --noEmit && npm test`); memory engine response times clocked under 50ms.

## Reflection Log Entry - 2026-10-19 (Student Quiz Question Skip on First-Wrong Retry State & Analytics Integrity)
- **Topic**: Student Quiz Question Skip on First-Wrong Retry State & Analytics Integrity
- **Target Surfaces**: `components/QuestionCard.tsx`, `hooks/useQuizGame.ts`, `scripts/verify-revizz.ts`

### Architectural Solutions & Key Insights
- **Pop-up Next Question Button on Retry Pattern**: In `QuestionCard.tsx`, rendered a tactile neobrutalist Next Question CTA (`data-testid="retry-next-button"`, `onClick={onNext}`) directly above the "1 retry left · 50% XP" alert prompt card when `status === 'first-wrong'`.
- **Unified Motion Wrapper Physics**: Grouped the Next button and retry alert into a single `motion.div` with spring physics (`stiffness: 500, damping: 20`, `flex flex-col gap-2.5 w-full`), ensuring both elements smoothly pop into view simultaneously on an initial wrong selection.
- **Dynamic Contextual CTA Labeling**: Labeled as `'See results →'` on the final question of a fixed round or `'Next question →'` during gameplay, keeping the interaction model consistent with first-try correct CTAs.
- **Skip Telemetry & Accuracy Mathematics Integrity**: In `useQuizGame.ts`, when the student clicks Next to skip the second attempt while in `first-wrong` status, `nextQuestion()` explicitly increments `wrongCount`, logs the question as `'wrong'` in `recordMissed()`, and computes `effectiveWrongCount` for `recordCompletedRound()`. This guarantees the round summary accuracy denominator (`correctFirstTry + correctRetry + wrongCount`) remains 100% mathematically balanced without dangling or uncounted attempts.

### Anti-Patterns & Bug Traps
- **Dangling Unresolved Attempt Trap**: Allowing a student to skip from `first-wrong` without incrementing `wrongCount` or updating `missedDetails` causes the round summary to display missing questions and distorted accuracy percentages. Always resolve the attempt state immediately upon skip.
- **Visual CTA Ordering Anti-Pattern**: Placing the skip button below the retry alert causes it to get pushed off-screen or overlooked on mobile screens; placing it immediately above the retry alert creates a natural, accessible escape hatch.

### Verification & Quality Assurance
- Automated tests added to `scripts/verify-revizz.ts` verifying DOM hierarchy, test IDs, and hook state handling.
- Verified 100% clean build (`npx tsc --noEmit`) and all 158 tests passing.
- Shipped atomically to GitHub `main` (`5a571bf`) and deployed to Vercel production (`https://revizz-sand.vercel.app` HTTP 200 OK).

## Reflection Log Entry - 2026-10-19 (Test Compiler Sticky Header Clean-Up, Live Search Relocation & Vercel Build Verification)
- **Topic**: Test Compiler Sticky Header Clean-Up, Live Search Relocation & Vercel Build Verification
- **Target Surfaces**: `components/portal/compiler/TestCompilerHub.tsx`, `package.json`, `scripts/wt.ts`

### Architectural Solutions & Key Insights
- **Test Compiler Sticky Header Modernization**: Removed redundant elements from the question list sticky header (`Question Bank` title, count pill, active filter pill) and placed the responsive question search bar (`id="compiler-search-input"`, `flex-1 min-w-[200px] max-w-md` with `X` clear button) in their place. Removed the duplicate search bar from the right-hand `Question Filters` card to streamline vertical sidebar space.
- **Vercel Clean-Container Parity Defense**: Restored `"rehype-raw": "^7.0.0"` and `"remark-gfm": "^4.0.1"` to `package.json`. Local `node_modules` caches can silently mask dependencies omitted from `package.json`; clean container CI/CD strictly requires explicit `package.json` entries for webpack module resolution.
- **Vercel CLI Build Verification Gate**: Upgraded `scripts/wt.ts` from an instantaneous HTTP GET probe to full execution of `npx vercel --prod --yes`. This guarantees that Vercel builds compile, lint, and deploy cleanly before any release is declared successful.

### Anti-Patterns & Bug Traps
- **Instant HTTP GET False Positive**: Running `curl` or `https.get` against production within milliseconds of `git push` hits the cached previous deployment because Vercel takes 45–60s to compile. Always verify through the Vercel CLI or wait for deployment status `● Ready`.
- **Local Dependency Cache Masking**: An undeclared package present in local `node_modules` allows `next build` and `tsc` to succeed locally while failing immediately on cloud CI/CD.

### Verification & Quality Assurance
- Automated tests: `npx tsc --noEmit` passed with 0 errors; all 158 automated tests passed across all 21 suites.
- Production build: Vercel deployment verified `● Ready` and aliased to `https://revizz-sand.vercel.app`.

