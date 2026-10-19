# Learnings and Reflections

## Reflection Log Entry - 2026-10-19 (Pixel 7 Pro Mobile Overflow & Sticky Header Bleed-Through Fix)

- **Date**: 2026-10-19
- **Feature / Area**: Student Profile & Settings Mobile UI (`components/profile/StudentSettingsPanel.tsx`, `components/Header.tsx`, `scripts/wt.ts`)
- **Problem & Requirements**:
  - User reported mobile UI overflow on Pixel 7 Pro with an attached screenshot of the Profile Settings page (`/profile?tab=settings`).
  - In "Default Quiz Gameplay Rules", the 4 "Default Round Length" buttons (3, 5, 10, 30 Questions) were rendered in a rigid 4-column grid (`grid-cols-4 gap-2.5`) with `whitespace-nowrap` and `scale-[1.02]`. On mobile (~392px–412px viewports), each column was constrained to ~75px, causing button borders and text labels to overlap and collide horizontally.
  - The sticky `<header>` used semi-transparent background with frosted blur (`bg-bg/95 backdrop-blur-xs`), allowing elements from preceding sections (`Q/day` buttons) to ghost and bleed through in the header's top padding when scrolling down.
  - "Daily Question Target" also required defensive layout tightening on compact mobile screens, and a synthetic "e.g. Alex Cambridge" placeholder needed to be sanitized per the zero-fake-data rule.
- **Architectural & UI Improvements**:
  1. **Responsive 2x2 / 4-Col Grid for Round Length (`components/profile/StudentSettingsPanel.tsx`)**:
     - Updated container to `grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5`.
     - Added `min-w-0 px-2 py-3 sm:py-3.5` and stripped `scale-[1.02]` on selected state, allowing comfortable fluid 2x2 wrap on mobile viewports without clipping or border collision while keeping 4 columns on desktop.
  2. **Daily Question Target Alignment**:
     - Adjusted container to `grid grid-cols-5 gap-1.5 sm:gap-2.5`.
     - Stacked numeric value and unit cleanly with `<span className="block text-sm sm:text-base leading-tight">{goal}</span>` and `<span className="block text-[10px] sm:text-xs font-bold text-neutral-600 leading-tight">Q/day</span>` plus `min-w-0`, preventing text squeeze.
  3. **Zero-Fake-Data Compliance**:
     - Sanitized input placeholder to `placeholder="e.g. Cambridge Scholar"`.
  4. **Solid Opaque Sticky Header (`components/Header.tsx`)**:
     - Removed `/95 backdrop-blur-xs` and set solid `bg-bg`, guaranteeing 100% occlusion of all scrolled elements on mobile and desktop viewports.
- **Verification & Deployment**:
  - Full verification gate executed via `npx tsx scripts/wt.ts verify fix-mobile-overflow` (0 TypeScript errors, 156/156 tests passing).
  - Released live to GitHub `main` (commit `a059229`) and Vercel production (`https://revizz-sand.vercel.app`) with HTTP 200 health probe verified.
  - Cleaned up isolated worktree `.worktrees/fix-mobile-overflow`.

## Reflection Log Entry - 2026-10-19 (Admin User Management Hub & Live Supabase CRUD API Wiring)

- **Date**: 2026-10-19
- **Feature / Area**: Admin Operations Deck & User Management (`app/admin/page.tsx`, `components/admin/AppAdminNav.tsx`, `components/admin/AppAdminHub.tsx`, `components/admin/UserManagementHub.tsx`, `app/api/admin/users/route.ts`, `scripts/verify-revizz.ts`)
- **Problem & Requirements**:
  - The App Admin Operations console lacked a dedicated user management dashboard, requiring platform administrators to manually query database tables to review student, teacher, and administrator accounts, adjust permissions, or manage institutional campus status.
  - Initial client-side implementation relied on temporary local storage overrides and encountered Supabase RLS restrictions and missing schema columns (`created_at` in `profiles`).
  - Need a production-grade, tactile 3D neobrutalist User Management Hub backed by a dedicated server-side Next.js route handler (`/api/admin/users`) with full CRUD operations, live persistence, and zero-fake-data compliance.
- **Architectural & Backend Improvements**:
  1. **Live Server API (`app/api/admin/users/route.ts`)**:
     - Engineered a unified Next.js route handler using `@supabase/supabase-js` with server-side credentials and Node.js WebSocket polyfill.
     - `GET`: Queries registered accounts from `public.profiles` and all invitations from `public.roster_invites` (72+ live records), de-duplicates by normalized email, computes live metric breakdowns (`total`, `students`, `teachers`, `admins`, `invites`, `schoolAccounts`), and returns a unified directory.
     - `POST`: Validates email formats and creates persistent roster invitations in `public.roster_invites` with standard UUIDs and timestamp tracking.
     - `PATCH`: Dynamically routes role changes (`student` $\leftrightarrow$ `teacher` $\leftrightarrow$ `admin`), campus account flags (`is_school_account`), and statuses (`active` $\leftrightarrow$ `invited` $\leftrightarrow$ `suspended`) directly into `public.profiles` or `public.roster_invites`.
     - `DELETE`: Safely deletes invitations or profile records from Supabase and purges client caches.
  2. **Tactile Neobrutalist UI (`components/admin/UserManagementHub.tsx`)**:
     - Real-time search by name/email with instant (`✕`) clear, role filter tabs (`All`, `Students`, `Teachers`, `Admins`, `Pending Invites`), and institutional account filters (`All Accounts`, `School Campus`, `Individual`).
     - Directory table with initials avatars, inline role switchers, campus status toggles, activity progress, status dropdowns, and confirmation modal for account revocation.
     - `+ Invite User` modal for pre-registering users with initial roles, cohorts, and campus flags via `/api/admin/users`.
     - 1-click CSV export and manual `↻ Sync with Supabase` toolbar refresh button with active connection pill (`🟢 Live Database Connected · {count} Total`).
     - Zero-fake-data standard strictly enforced; offline-first localStorage cache for instant zero-flicker render.
  3. **Database Schema Harmonization**:
     - Added `created_at timestamptz DEFAULT now()` column to `public.profiles` in Supabase Postgres to guarantee chronological sorting queries resolve reliably.
  4. **Admin Portal Navigation & Router Integration**:
     - Registered `'users'` navigation button with `Users` icon and "Roles" badge in `AppAdminNav.tsx`.
     - Wired `case 'users': return <UserManagementHub onSelectTab={onSelectTab} />;` into `AppAdminHub.tsx`.
     - Registered `users: 'User Management'` in `TAB_TITLES` and URL search parameter query normalization in `app/admin/page.tsx` (`/admin?tab=users`).
- **Verification & Deployment**:
  - Expanded Suite 21 in `scripts/verify-revizz.ts` verifying API route existence, HTTP method exports (`GET`, `POST`, `PATCH`, `DELETE`), and frontend API wiring.
  - All 156 test assertions passed cleanly; 0 TypeScript errors (`tsc --noEmit`); 0 forbidden strings across 10 target files (`verify-fake-data-purge.ts`).
  - Commits `1cca5dd` and `a03deb5` rebased, pushed to `origin/main`, deployed to Vercel production (`https://revizz-sand.vercel.app/admin?tab=users`), and verified with live HTTP 200 health probe.

## Reflection Log Entry - 2026-10-19 (Student Quiz 4-Option Question Format Filter: All, Graph, Diagram, Text)

- **Date**: 2026-10-19
- **Feature / Area**: Student Quiz Launcher & Gameplay (`components/StartFlow.tsx`, `hooks/useQuizGame.ts`, `lib/questions.ts`, `app/page.tsx`, `lib/studentProfile.ts`, `components/profile/StudentSettingsPanel.tsx`, `scripts/verify-diagram-filter.ts`)
- **Problem & Requirements**:
  - The student quiz launcher previously presented a 3-button format filter (`All`, `Diagrams`, `Text`) in a grid layout with mismatched styling compared to the `Round length` pill buttons.
  - The user requested: "to the filers add 'diagram' filter for questions with diagrams only. match the current button styles" followed by "add the graph filter button back, so 4 options: all, graph, diagram, text".
  - Need to differentiate coordinate curves/economic graphs from visual schematics/apparatus diagrams while preserving text-only filtering and full-bank fallback.
- **Architectural & UI Improvements**:
  1. **Type Contract (`hooks/useQuizGame.ts`)**:
     - Expanded `DiagramFilter = 'all' | 'mixed' | 'graph' | 'diagram' | 'diagrams' | 'text' | 'no-diagrams'` to maintain 100% backward compatibility with stored user preferences and previous test suites.
  2. **Filtering Engine (`lib/questions.ts`)**:
     - Created `isGraphQuestion(q)` with regex keyword scanning across stem markdown, alt descriptions, and tags (`graph`, `curve`, `ppc`, `axis`, `equilibrium`, `tariff`, `exchange rate`, etc.).
     - Refactored `filterQuestionsByDiagram`:
       - `'all'` / `'mixed'`: returns all questions.
       - `'graph'`: filters with `isGraphQuestion` (fallback to `isDiagramQuestion` if none).
       - `'diagram'`: filters non-graph diagrams (`isDiagramQuestion && !isGraphQuestion`, fallback to `isDiagramQuestion`).
       - `'diagrams'`: returns all `isDiagramQuestion` (legacy test contract).
       - `'text'` / `'no-diagrams'`: returns `!isDiagramQuestion`.
  3. **Tactile Pill UI (`components/StartFlow.tsx`)**:
     - Replaced 3-column grid with `flex flex-wrap gap-2` matching the `Round length` selector above it.
     - 4 tactile pill buttons: `🔀 All`, `📈 Graph`, `📊 Diagram`, `📝 Text` with `rounded-full`, terracotta active accent (`bg-accent text-neutral-100 shadow-offset-2`), and `data-testid` attributes.
  4. **Student Settings & Persistence (`lib/studentProfile.ts`, `components/profile/StudentSettingsPanel.tsx`)**:
     - Integrated `Graphs Only` into student settings preferences and local storage (`revizz_last_config`).
- **Verification & Deployment**:
  - Automated tests updated in `scripts/verify-diagram-filter.ts` covering all 4 options.
  - All 154 repository tests passed cleanly with 0 TypeScript compilation errors.
  - Shipped live to production via `scripts/wt.ts ship student-diagram-filter` (commit `a197789`), deployed to Vercel production (`https://revizz-sand.vercel.app`), verified with HTTP 200 probe, and worktree pruned cleanly.


## Reflection Log Entry - 2026-10-19 (Student Quiz & Round Summary Data Table Rendering via GFM)

- **Date**: 2026-10-19
- **Feature / Area**: Student Quiz & End-of-Round Summary (`components/QuestionCard.tsx`, `components/RoundSummary.tsx`, `package.json`, `scripts/verify-quiz-tables.ts`)
- **Problem & Requirements**:
  - Questions containing data tables (e.g. Cambridge 0455/12 May/June 2024 Q6, Q10, Q12, Q14, Q24, Q29, Q30) were not displaying tables in the quiz gameplay view.
  - Root cause: `ReactMarkdown` was configured strictly with `remarkPlugins={[remarkMath]}` and `rehypePlugins={[rehypeKatex]}` without `remark-gfm` and `rehype-raw`. Standard CommonMark does not support markdown table syntax, rendering pipe delimiters as plain text paragraphs.
  - Furthermore, Cambridge questions use inline `<br>` tags in table column headers (e.g. Q29 and Q30), which were escaped as raw text (`&lt;br&gt;`) without `rehype-raw`.
  - In `RoundSummary.tsx`, collapsed missed question cards leaked raw table pipes into the 2-line header, and expanding the card did not render the question stem or table.
- **Architectural & UI Improvements**:
  1. **Dependencies**: Added `remark-gfm` (^4.0.0) and `rehype-raw` (^7.0.0).
  2. **`components/QuestionCard.tsx`**:
     - Configured `ReactMarkdown` with `remarkPlugins={[remarkMath, remarkGfm]}` and `rehypePlugins={[rehypeRaw, rehypeKatex]}` for both question stems and options.
     - Added custom neobrutalist table renderers (`table`, `thead`, `tbody`, `tr`, `th`, `td`) with horizontal scroll containers (`overflow-x-auto rounded-xl border-2 border-text bg-white shadow-offset-2`), tactile accent headers (`bg-accent-2-100 font-heading text-xs tracking-wider`), and subtle zebra hover rows.
  3. **`components/RoundSummary.tsx`**:
     - Sanitized collapsed preview using pre-table text extraction (`item.question.stem_markdown.split(/\n\s*\|/)[0]`) so headers remain clean.
     - Rendered full question stem with complete table and math formatting inside the expanded review panel, plus formatted correct answer option pills.
- **Verification & Deployment**:
  - Authored `scripts/verify-quiz-tables.ts` verifying `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`, and unescaped `<br/>` elements across all 7 target Cambridge table questions (83/83 checks passed).
  - All 154 QA test suite assertions passed cleanly with 0 TypeScript compilation errors.
  - Cleanly rebased and shipped via `scripts/wt.ts ship` (commit `3460394`), deployed to Vercel production (`https://revizz-sand.vercel.app`), verified with HTTP 200 probe, and worktree pruned cleanly.

## Reflection Log Entry - 2026-10-18 (Teacher Test Compiler Multi-Topic Filtering & Auto-Compile Presets)

- **Date**: 2026-10-18
- **Feature / Area**: Teacher Portal Test Compiler (`components/portal/compiler/TestCompilerHub.tsx`, `lib/compilerFilters.ts`, `scripts/verify-teacher-compiler-topic-filter.ts`)
- **Problem & Requirements**:
  - Educators previously had only a single native `<select>` dropdown to filter questions by topic, restricting worksheet generation to either a single chapter or the entire syllabus.
  - Auto-generate test presets could only target one topic or all topics mixed, with no ability to focus question assembly across a specific subset of chapters (e.g. Microeconomics Chapters 1 & 2).
- **Architectural & UI Improvements**:
  1. **Compiler Filter Engine (`lib/compilerFilters.ts`)**:
     - Extended `CompilerFilterOptions` with `topicIds?: string[]` while maintaining backward compatibility with `topicId?: string`.
     - Updated `filterAndSortQuestions` to filter questions across multiple topic IDs simultaneously.
     - Enhanced `countActiveFilters` so active topic filters increment the badge count without duplicate counting if both `topicIds` and `topicId` are provided, preserving all 8 filter dimensions in Suite 7.
  2. **Tactile Multi-Topic Popover (`components/portal/compiler/TestCompilerHub.tsx`)**:
     - Replaced the native select dropdown with a custom neobrutalist topic selector with `aria-haspopup="listbox"`, chapter badges (`Ch 1`), live question counts, and toggle checkboxes.
     - Added quick "All Topics" and "Clear" action buttons.
     - Added removable active filter chips with `✕` buttons in both collapsed and expanded filter summary bars.
  3. **Auto-Generate Modal Multi-Topic Presets**:
     - Upgraded the Auto-Generate dialog with `autoTopicIds: string[]`, enabling teachers to specify multiple syllabus chapters when generating random assessments.
- **Verification & Deployment**:
  - Verified with `scripts/verify-teacher-compiler-topic-filter.ts` (40/40 checks passed).
  - All 139 repository tests passed cleanly with 0 type errors.
  - Cleanly rebased onto latest `origin/main` (`fe0da94`), atomically pushed via branch `feat/teacher-compiler-topic-filter-10181622` (commit `2bfbd58`), and deployed live to production on Vercel (`HTTP 200 OK`).

## Reflection Log Entry - 2026-10-18 (Student Practice Flow: Multi-Topic Selection Pop-Up Modal)

- **Date**: 2026-10-18
- **Feature / Area**: Student Start Flow & Game Engine (`components/StartFlow.tsx`, `app/page.tsx`, `scripts/verify-topic-selection.ts`)
- **Problem & Requirements**:
  - Selecting "Topic practice" (📚) in `StartFlow.tsx` previously locked the student into an unfiltered round across the entire syllabus without any way to choose which chapter to drill.
  - Students needed an intuitive way to pick one or more specific Cambridge syllabus chapters for targeted exam practice.
- **Architectural & UI Improvements**:
  1. **Automatic Multi-Select Pop-Up Modal (`components/StartFlow.tsx`)**:
     - Clicking "Topic practice" automatically launches a tactile 3D modal with backdrop blur and Escape key handling.
     - Multi-select checkbox cards display chapter order badges (`Ch 1`), topic names, and available question counts.
     - Quick "Select All" and "Clear" shortcuts, plus an empty-state guard that automatically defaults to all topics to prevent empty rounds.
     - Mode card subtitle updates dynamically: `Drilling: <Topic>` or `X topics selected (Y Qs)`.
     - An inline summary button (`[ Edit Topics ✎ ]`) allows re-opening the popup at any time.
  2. **Game Engine Pool Filtering (`app/page.tsx`)**:
     - Updated `handleStartStandard()` to split comma-separated topic IDs and filter questions using `targetTopicIds.has(q.topic_id)`.
     - Fully backward-compatible with `'all'` and single-topic practice.
     - Selection state is preserved across reloads via `localStorage` (`revizz_last_config`).
- **Verification & Deployment**:
  - Verified with `scripts/verify-topic-selection.ts` across single-topic, multi-topic, and all-topics modes.
  - All 139 repository tests passed cleanly with 0 type errors.
  - Released atomically via `feat/topic-selection-mode-10181556` (commits `e939808` and `43d7e97`), verified live on Vercel production (`HTTP 200 OK`).

## Reflection Log Entry - 2026-10-18 (1-Command "Push Live" Skill & Automated GitHub + Vercel Ship Pipeline)

- **Date**: 2026-10-18
- **Feature / Area**: Deployment Automation, Git Worktree Lifecycle & Skill Documentation (`.agent/skills/revizz-push-live/SKILL.md`, `scripts/worktree-cli.js`)
- **Problem & Requirements**:
  - Shipping an isolated feature worktree previously required a manual 6-step sequential sequence: stopping local port 3000 servers, checking git diffs, manual committing, fetching/rebasing on `origin/main`, running verification gates, atomic git pushing (`git push origin <branch>:main`), executing Vercel CLI deploys with curl verification, and cleaning up worktrees.
  - Manual coordination introduced friction, token consumption across turns, and potential human error in teardown.
- **Architectural & Automation Improvements**:
  1. **1-Command Push Live (`npm run wt ship`)**:
     - Documented and established `.agent/skills/revizz-push-live/SKILL.md` to trigger on `"push live"`, `"ship it"`, or `"push and redeploy"`.
     - Collapses the entire release cycle into a single atomic command: `npm run wt ship [topic] -m "<msg>" [--fast]`.
  2. **Automated 6-Step Pipeline Execution**:
     - Automatically stops dev servers on port 3000 and removes `.next/dev/lock`.
     - Stages and commits uncommitted worktree changes with custom or semantic commit messages.
     - Fetches and cleanly rebases on `origin/main`, executing full `npx tsc --noEmit && npm test` verification gates (or skipping redundant tests via `--fast` if the state is verified and unchanged).
     - Pushes isolated worktree commits directly to `origin/main` without exposing WIP commits on local `main`.
     - Triggers `npx --yes vercel --prod --yes` and probes `https://revizz-sand.vercel.app` for `HTTP 200 OK`.
     - Automatically removes `.worktrees/<topic>` and prunes the local branch.
  3. **Strict Master-Only Guardrails**:
     - Enforces that `npm run wt ship` is strictly initiated by the Master Orchestrator upon explicit user instructions, preventing accidental or unauthorized deployments by subagents.

## Reflection Log Entry - 2026-10-18 (Question Bank 100-Question Page Size & Column Streamlining)

- **Date**: 2026-10-18
- **Feature / Area**: Question Bank Table & Pagination (`components/portal/AdminTools.tsx`)
- **Problem & Requirements**:
  - The Question Bank in `/portal` and `/admin` defaulted to a restrictive 20 questions per page, requiring frequent page turns when reviewing large paper batches.
  - The table header and rows contained 10 columns (Admin) and 6 columns (Teacher), causing horizontal crowding and visual noise with low-priority columns: `1st try`, `updated`, `difficulty`, `citation`, and `id`.
- **Architectural & UI Improvements**:
  1. **Page Size Expansion**:
     - Increased `pageSize` from `20` to `100` in `components/portal/AdminTools.tsx`.
     - Automatically adapted total pages calculation, slice bounds, post-deletion clamping, and pagination footer indicators.
  2. **Column Streamlining**:
     - Removed `1st try`, `updated`, `difficulty`, `citation`, and `id` from table headers and rows in both Teacher and Admin portal modes.
     - Teacher grid simplified from 6 columns to 3 columns (`grid-cols-[1fr_260px_130px]`): Question & Classroom Tags, Topic, and Classroom action.
     - Admin grid simplified from 10 columns to 5 columns (`grid-cols-[38px_1fr_240px_90px_44px]`): Checkbox, Stem (with expand chevron), Topic, Status badge, and Delete action.
     - Replaced the standalone ID column's expand chevron by smoothly anchoring `ChevronDown` beside `item.stem`.
     - Reduced table container min-width from `min-w-[920px]` to `min-w-[680px]` to eliminate horizontal scrollbar clutter on standard laptop screens.
  3. **Zero-Loss Detail Accordion**:
     - Preserved all rich citation strings, official Cambridge IDs, difficulty tags, and educator notes inside the expandable question detail panel (`isExpanded`).
- **Verification & Deployment**:
  - Verified with `npm run wt verify`: `npx tsc --noEmit` passed with 0 errors; `npm test` passed 139/139 assertions.
  - Successfully released to production via `npm run wt release`: commits `6510855` and `fe0da94` pushed to `origin/main`.
  - Production deployment verified live on Vercel at `https://revizz-sand.vercel.app` (HTTP 200 OK).
  - Merged worktree `.worktrees/bank-page-size-100` cleanly pruned.



- **Date**: 2026-10-18
- **Feature / Area**: Local Dev Server Worktree Automation & Agent Skill (`.agent/skills/revizz-local-server/SKILL.md`, `scripts/wt.ts`)
- **Problem & Requirements**:
  - Developers and agents attempting to start the local Next.js dev server frequently encountered 10-second `IsDaemon` timeouts, port 3000 collisions, and `.next/dev/lock` errors across isolated worktrees.
  - A fast, deterministic 1-command workflow was needed to spawn detached background dev instances within ~2 seconds and cleanly terminate them in <100ms.
- **Architectural & Automation Improvements**:
  1. **Revizz Local Server Skill (`.agent/skills/revizz-local-server/SKILL.md`)**:
     - Codified standard operating procedures for `"start local"`, `"run local server"`, `"preview local"`, and `"kill server"`.
     - Specified single tool call `WaitMsBeforeAsync: 5000` synchronous execution with detached background process unreferencing (`unref()`).
     - Documented port 3000 auto-cleanup (`lsof -ti:3000 | xargs kill -9`) and `.next/dev/lock` purging.
     - Documented critical guardrails preventing `next build` execution while `next dev` is running concurrently in the same worktree.
  2. **Worktree Automation CLI Integration (`npm run wt serve` & `npm run wt stop`)**:
     - Enables 1-command startup (`npm run wt serve <topic>`) targeting active or recent worktrees with live readiness polling.
     - Provides instant teardown (`npm run wt stop`) and automatic cleanup hooks within `npm run wt clean <topic>`.
- **Verification**:
  - Skill documentation verified and indexed in `.agent/skills/revizz-local-server/SKILL.md`.

## Reflection Log Entry - 2026-10-18 (Admin Settings Hub Harmonization & Portal Menu Consolidation)

- **Date**: 2026-10-18
- **Feature / Area**: Admin Dashboard Navigation & Settings Hub (`components/admin/AdminSettingsHub.tsx`, `components/admin/AppAdminNav.tsx`, `components/admin/AppAdminHub.tsx`, `app/admin/page.tsx`)
- **Problem & Requirements**:
  - The Teacher Portal Menu Manager was positioned as a separate top-level item on the main admin navigation sidebar, adding unnecessary vertical clutter alongside "Platform Settings".
  - The main menu label "Platform Settings" was verbose and needed streamlining to simply "Settings".
  - The Portal Menu Manager needed to be nested as an authentic sub-panel within the Settings hub without breaking existing bookmarks or direct URL references to `?tab=portal-menu`.
- **Architectural & UI Improvements**:
  1. **Consolidated Sub-Panel in AdminSettingsHub**:
     - Extended `SettingsSubTab` union type to include `'portal-menu'`: `'school' | 'system' | 'ingestion' | 'gameplay' | 'auth' | 'portal-menu'`.
     - Added 6th pill in the Settings sub-tab navigation bar with `Menu` icon, `'Portal Menu Manager'` label, and `'Nav Editor'` badge.
     - Embedded `<PortalMenuManager />` seamlessly within the sub-panel container.
  2. **Streamlined Main Menu in AppAdminNav**:
     - Renamed navigation button title and label from "Platform Settings" to "Settings".
     - Updated counter badge from "5 Panels" to "6 Panels".
     - Removed standalone `portal-menu` button from sidebar while retaining static contract compatibility for test suites.
  3. **Lossless Deep-Link Redirection in Page & Hub**:
     - Updated `TAB_TITLES.settings` to `'Settings'`.
     - In `app/admin/page.tsx` and `AppAdminHub.tsx`, mapped `tab=portal-menu` requests to activate `settings` with sub-tab `portal-menu` and update URL to `?tab=settings&sub=portal-menu`.
- **Verification & Deployment**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm test`: 139/139 unit tests passing.
  - `npx tsx scripts/verify-admin-settings.ts`: 6/6 tests passing.
  - `npx tsx scripts/verify-portal-nav.ts`: 17/17 tests passing.
  - Independent live release atomic push executed to `origin/main` (`f84489a`).


## Reflection Log Entry - 2026-10-18 (User Account Modal Redesign, Tactile 3D Styling & Mobile Overflow Defense)

- **Date**: 2026-10-18
- **Feature / Area**: Student User Account & Leaderboard Modal (`components/LeaderboardModal.tsx`, `components/Header.tsx`, `components/ads/AdSlotBanner.tsx`)
- **Problem & Visual Bugs**:
  - Clicking the compact user avatar button in the header opened an outdated modal titled `"🏆 Weekly Leaderboard"`, which lacked user account focus.
  - On narrow/mobile viewports, the modal overflowed horizontally and was clipped by `overflow-hidden`:
    - "Your Stats" row pushed the guest badge and "Exit Demo / Sign Out" against the right border, truncating the button text to `"Ex..."`.
    - Long button text `"Log In with Google to Join Global Leaderboard"` pushed min-width and was clipped to `"Leaderbo..."`.
    - Partner ad banner (`"EXAMPLE · QUICK REFERENCE"`) had its `"Open"` button clipped into `"Ope..."`.
    - Modal styling was in legacy blue tones (`bg-blue-50`, `border-slate-800`), out of harmony with Revizz's tactile 3D neobrutalist aesthetic.
- **Architectural & UI Improvements**:
  1. **Dual-Tab Segmented Architecture**:
     - Introduced tactile segmented tabs `[ 👤 My Account ]` and `[ 🏆 Leaderboard ]` beneath the header.
     - Header avatar click automatically opens directly to `'account'` tab via `initialTab={modalTab}` in `components/Header.tsx`.
  2. **Student Account Identity & Action Flows**:
     - Large initials avatar, student display name, and contextual status tags (`⚡ Guest Session · Unsaved`, `✨ Verified Student`, `🎓 School Account`).
     - 3-card stats summary grid (`Total XP`, `Streak 🔥`, `Status`).
     - Clear, mobile-friendly Google Sign-In button (`"Sign In with Google"`, gold `#FACC15`, `min-h-[44px]`), real-time auth alerts, and `"Exit Demo / Reset Session"` action.
     - Clean toggle for public leaderboard participation for authenticated accounts.
  3. **Mobile Overflow Defense**:
     - Replaced rigid dialog sizing with responsive width `w-[calc(100vw-24px)] sm:w-full sm:max-w-md` and `max-h-[90vh] flex flex-col`.
     - In `components/ads/AdSlotBanner.tsx`, added `w-full max-w-full min-w-0 overflow-hidden`, `truncate` on headlines, and `shrink-0 whitespace-nowrap` on CTA button links so external actions like `"Open"` can never be clipped.
- **Verification & Deployment**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm test`: 139/139 unit tests passing.
  - `npx tsx scripts/verify-ads-system.ts`: 235/235 assertions passing.
  - Atomic release pushed cleanly to `origin/main` (`1487549`) and worktree torn down (`npm run wt clean user-account-modal`).



## Reflection Log Entry - 2026-10-18 (Worktree Hygiene Pruning & Unconstrained Search Latency Prevention)

- **Date**: 2026-10-18
- **Feature / Area**: Workspace Search Hygiene, Git Worktree Lifecycle & Memory Documentation (`scripts/wt.ts`, `.agent/memory/learnings_and_reflections.md`)
- **Problem & Root Cause**:
  - The master orchestrator experienced an unexpected initialization delay when checking whether v11.3 operating rules were present in the codebase.
  - The root cause was an unconstrained recursive search from the workspace root (`grep -rn "Flash Master" .`). Because the repository had 14 active worktrees under `.worktrees/`, `grep` traversed tens of thousands of duplicate build files and dependencies, exceeding the 3-second synchronous tool timeout and falling back to a background task.
- **Action Taken & Worktree Pruning**:
  1. **Ancestor Verification**: Queried `git branch --merged origin/main` to identify worktrees whose commits were already integrated into remote main.
  2. **Automated Cleanup**: Executed `npm run wt clean <topic>` on 5 merged feature worktrees:
     - `ads-system` (`feat/ads-system-10181450`)
     - `header-icon-order` (`feat/header-icon-order-10181533`)
     - `katex-spacing-10171957` (`feat/katex-spacing-10171957`)
     - `settings-tab-consolidation` (`feat/settings-tab-consolidation-10181539`)
     - `user-account-modal` (`feat/user-account-modal-10181536`)
  3. **Result**: Reduced active worktrees from 14 to 9 (1 main + 8 active feature worktrees), reclaiming disk space and removing stale branches.
- **Architectural Rules & Invariants Formulated**:
  - **Atlas First**: Always query `.agent/CODEBASE_MAP.md` via `npm run map query <symbol>` or inspect `.agent/` directly rather than executing broad recursive searches across root.
  - **Exclude Flags for Raw Grep**: Any shell search from the project root MUST explicitly exclude directories: `--exclude-dir={node_modules,.worktrees,.next,.git}`.
  - **Continuous Worktree Pruning**: Regularly run `npm run wt clean <topic>` after atomic live releases (`npm run wt release <topic>`) to prevent worktree directory bloat.


## Reflection Log Entry - 2026-10-18 (Header Single-Row Consolidation & Minimalist Menu Streamlining)

- **Date**: 2026-10-18
- **Feature**: Single-Row Header Consolidation & Menu Simplification (`components/Header.tsx`, `scripts/wt.ts`)
- **Problem & Requirements**:
  - The user uploaded an image of the header controls split into two stacked rows and requested: "move everything to one row on the top."
  - Following the single-row consolidation, the user requested: "remove all buttons in the menu except the user icon and the mute button. have the user icon on the right and mute on the left", confirming the preferred layout with REVIZZ on the left and the Mute + User icon controls on the right (`[REVIZZ] ──────── [Mute] [User]`).
  - Finally, the user instructed "start local", verified the server, and requested "kill server, push live, redeploy" followed by "end chat".
- **Architecture & Fleet Execution**:
  1. **Worktree Isolation (`header-single-row` & `header-cleanup`)**:
     - Adhered strictly to Rule 12 by provisioning isolated worktrees off `origin/main` (`feat/header-single-row-10181520` and `feat/header-cleanup-10181534`) via `npm run wt create`.
  2. **Single-Row Consolidation (`components/Header.tsx`)**:
     - Dispatched Flash subagent to collapse the legacy 2-row layout into a single, slim, responsive flex row (`max-w-[540px] mx-auto flex items-center justify-between gap-1.5 sm:gap-2`), recovering substantial vertical viewport headroom on mobile.
     - Preserved REVIZZ brand typography, tilted star badge, and navigation semantics.
  3. **Menu Simplification (`components/Header.tsx`)**:
     - Dispatched Flash subagent to prune noisy telemetry pills (XP chip, streak flame pill, and trophy button) from the navigation bar.
     - Reordered the right-side cluster so the tactile Sound Toggle (Mute button) sits on the left, and the compact User Profile Avatar sits on the right.
     - Maintained full interactive integrity: Mute toggles sound effects with spring feedback; User Avatar opens the Profile & Leaderboard modal for authenticated users or prompts Google Sign-In for guests.
     - Cleaned up unused local state variables (`streakBg`, `flameFill`) to prevent stale dead code.
  4. **Quality Gate Verification & Atomic Live Release**:
     - Executed full worktree verification via `npm run wt verify`: 139/139 unit tests and runtime assertions passing, 0 TypeScript compilation errors, and automatic Codebase Map synchronization.
     - Performed atomic live push via `npm run wt release header-cleanup` (commit `ef5c965` pushed to `origin/main`), seamlessly triggering Vercel CI/CD production deployment.
     - Torn down feature worktrees cleanly via `npm run wt clean header-cleanup` with zero lingering unmerged branches.

## Reflection Log Entry - 2026-10-18 (Enhanced Student Correct Answer Visual Feedback)

- **Date**: 2026-10-18
- **Feature**: Enhanced Correct Answer Feedback (`components/QuestionCard.tsx`, `scripts/verify-revizz.ts`)
- **Problem & Requirements**:
  - The user requested: "in the student test ui. when the question in answered correctly I want there to be more indication that the user got the answer correct."
  - Previously, answering a question correctly rendered the explanation at the bottom of the card, but students had to scan down past the options or look closely at subtle option styling to confirm they were right.
- **Architecture & Fleet Execution**:
  1. **Worktree Isolation**: Created dedicated worktree `.worktrees/correct-feedback` off `origin/main` (`feat/correct-feedback-10181509`) via `npm run wt create correct-feedback`.
  2. **Celebratory Top Banners (`components/QuestionCard.tsx`)**:
     - Added a high-visibility, tactile neobrutalist celebration banner (`data-testid="correct-answer-banner"`, `bg-accent-2-300 border-2 border-text shadow-offset-3`) right above the options list.
     - Displays headline `"Correct! Spot on 🎉"`, subtitle `"Option {correctLetter} · First-try mastery"`, active `🔥 Streak` pill, and `+{gainedXP} XP` reward pill.
     - Placed immediately above the prominent Next Question CTA button so learners get instant positive validation and one-click progression without scrolling.
     - Added a dedicated retry-success banner (`data-testid="retry-correct-banner"`) for 2nd-attempt correct answers (`"Correct on retry! 👍"`, `"Option {correctLetter} · Added to Review Pile"`).
  3. **Selected Correct Option Highlighting & Badges (`components/QuestionCard.tsx`)**:
     - Distinguished learner-selected correct answers (`isCorrectPick`) from unpicked/timeout revealed correct answers.
     - Enhanced the selected card with an intense green focus ring and deeper shadow (`bg-accent-2-300 ring-4 ring-accent-2-500/40 shadow-offset-4 font-black`).
     - Added spring pop motion physics (`stiffness: 500, damping: 22`) and a high-contrast pill badge: `<span data-testid="correct-option-pill">✓ Correct · +{gainedXP} XP</span>` (`bg-accent-2-600 text-neutral-100 shadow-offset-2`).
  4. **Automated Verification (`scripts/verify-revizz.ts`)**:
     - Added test `'QuestionCard Correct Feedback: Celebratory banner and selected correct option badge are rendered'`.
     - Verified all 139/139 tests passed cleanly with 0 TypeScript compilation errors.
  5. **Live Release & Cleanup**:
     - Executed atomic release to `origin/main` via `npm run wt release correct-feedback` (commit `2190809`), triggering Vercel production deployment.
     - Cleaned up the worktree and pruned local branch via `npm run wt clean correct-feedback`.

## Reflection Log Entry - 2026-10-18 (Complete Removal of Admin & Teacher Panel Access from Student Side)

- **Date**: 2026-10-18
- **Feature**: Complete Removal of Admin & Teacher Access Points from Student UI (`components/Header.tsx`, `app/page.tsx`)
- **Problem & Requirements**:
  - The user requested: "remove the "portal" button from the user side pages", followed by "completely remove the button to access admin or teachers panel from the student user side."
  - Previously, the top navigation header on student pages exposed both the "Portal 🎓" pill link and conditionally the "Admin 🛠️" pill link (rendered for administrators and development environments).
  - In addition, the empty question bank state in `app/page.tsx` rendered a "Go to Educator Portal →" button linking directly to `/portal`.
- **Architecture & Fleet Execution**:
  1. **Worktree Isolation**: Created `.worktrees/remove-portal-btn` from `origin/main` (`feat/remove-portal-btn-10181437`) via `npm run wt create remove-portal-btn`.
  2. **Header Navigation Scrub (`components/Header.tsx`)**:
     - Removed the Educator Portal pill link (`<Link href="/portal"...>`).
     - Dispatched Flash subagent to remove the Admin Pill (`<Link href="/admin"...>`) and purged unused `isDev` and `isAdmin` flags.
     - Preserved all learner-essential controls: REVIZZ Home logo, audio toggle, leaderboard modal button, and user profile pill.
  3. **Empty State Scrub (`app/page.tsx`)**:
     - Dispatched parallel Flash subagent to remove the Educator Portal button (`<Link href="/portal"...>`) from the `questions.length === 0` empty state.
     - Updated empty state text to be student-appropriate ("The question bank is currently empty. Check back soon for new practice questions!").
     - Removed unused `Link` import from `app/page.tsx`.
  4. **Verification & Release**:
     - Full verification passed via `npm run wt verify remove-portal-btn`: 138/138 QA tests passing, 0 TypeScript errors.
     - Confirmed local dev server healthy (`HTTP 200 OK` on `http://localhost:3000`).
     - Atomic live push to `origin/main` (`2f01cd9`) via `npm run wt release remove-portal-btn`, automatically triggering Vercel CI/CD production deployment.

## Reflection Log Entry - 2026-10-18 (Demo Review Pile Restriction & Storage Guard)

- **Date**: 2026-10-18
- **Feature**: Review Pile Locked for Demo Accounts (`components/StartFlow.tsx`, `hooks/useQuizGame.ts`, `app/page.tsx`, `scripts/verify-revizz.ts`)
- **Problem & Requirements**:
  - The user requested: "when the account is demo, do not have review pile enabled. only have the saved review pile for logged in accounts."
  - Demo accounts previously had access to the Review Pile mode button and mistakes made during demo rounds were being queued into persistent local storage.
- **Architecture & Fleet Execution**:
  1. **UI Lock & Auto-Reset (`components/StartFlow.tsx`)**:
     - Mode 3 ("Review pile") card is locked with a Neobrutalist disabled state (`opacity-70 bg-neutral-100/60 border-neutral-300 cursor-not-allowed`).
     - Displayed lock icon (`🔒`), subtitle *"Requires a logged-in account to save your mistake pile"*, and locked tag `🔒 Log In to Save`.
     - Added effect resetting `selectedMode` to `'standard'` if `'review'` was selected when entering demo mode.
  2. **Storage Guard (`hooks/useQuizGame.ts`)**:
     - Guarded all `addToReviewPile(currentQ.id)` invocations behind `!isDemoSession && Boolean(userProfile?.email)`. Demo student mistakes are never written to the saved review pile.
  3. **Page Flow & Round Rerouting (`app/page.tsx`)**:
     - Blocked `handleStartReviewPile` when `isDemoSession` is active.
     - Routed "Play Again" to standard rounds for demo users.
  4. **Verification & Release**:
     - Added `Demo Review Pile Guard Contract` test to `scripts/verify-revizz.ts` (138/138 passing).
     - Released via `npm run wt release demo-review-pile-guard` with atomic push to `origin/main` (`65bbf72`).
     - Safely cleaned up feature worktree.

## Reflection Log Entry - 2026-10-18 (Student Topic Mastery Popup Live Search)

- **Date**: 2026-10-18
- **Feature**: Real-Time Topic Search in Topic Mastery Popup (`components/TopicMasteryList.tsx`, `scripts/verify-revizz.ts`)
- **Problem & Requirements**:
  - Learners viewing the Topic Mastery popup needed a fast way to find specific syllabus topics without scrolling through all chapters.
  - The user requested: "in the user side, in the 'topic master' popup, add the ability to seach for topics by typing."
- **Architecture & Fleet Execution**:
  1. **Topic Filtering Engine (`components/TopicMasteryList.tsx`)**:
     - Declared `searchQuery` state unconditionally at the top of the component.
     - Implemented case-insensitive real-time filtering against topic names and chapter order indices.
     - Crafted a 3D Neobrutalist search bar with search SVG icon, input field (`placeholder="Search topics by name..."`), focus ring, and one-click clear button (`✕`).
     - Added keyboard accessibility: `Escape` key clears search query; accessible `aria-label` attributes for WCAG AA compliance.
     - Built a dedicated tactile empty state card rendering a search lens, informative message, and "Clear search" CTA when no syllabus chapters match the query.
  2. **Automated Verification (`scripts/verify-revizz.ts`)**:
     - Added static code contract test verifying search input, aria labels, clear button, and empty state without violating the `--jsx` standalone node runtime constraint.
     - 137/137 tests passing cleanly with 0 TypeScript errors.
  3. **Release & Teardown**:
     - Atomic live push to `origin/main` (`d6e19f2`) via `npm run wt release topic-search`, triggering automatic Vercel production deployment.
     - Worktree removed and branch pruned cleanly.

## Reflection Log Entry - 2026-10-18 (Student Authentication Gate & Mock Identity Purge)

- **Date**: 2026-10-18
- **Feature**: Student Authentication Gate & Mock Data Elimination (`components/StudentAuthGate.tsx`, `app/page.tsx`, `components/Header.tsx`, `components/StartFlow.tsx`, `components/LeaderboardModal.tsx`, `lib/auth.ts`, `scripts/verify-fake-data-purge.ts`)
- **Problem & Requirements**:
  - The user requested: "i want to work on the user side. remove all fake information and names, when a user loads in they have to select demo or log in with google."
  - Previously, cold loads defaulted to a guest educator profile or synthetic fallback ("Alex M.", "Frontier Int'l"), bypassing explicit onboarding choices and leaking synthetic names into the student interface.
- **Architecture & Fleet Execution**:
  1. **Session State Engine (`lib/auth.ts`)**:
     - Introduced `demo-student-local` session helpers (`signInAsDemoStudent`, `getDemoStudentSession`, `clearDemoStudentSession`, `isDemoStudentSession`).
     - Refactored `useAuth` so unauthenticated cold loads resolve strictly to `null`, requiring an active user decision.
     - Unified `signOut()` to wipe both demo and guest sessions while signing out of Supabase.
  2. **Tactile Entry Gate (`components/StudentAuthGate.tsx` & `app/page.tsx`)**:
     - Built a 3D Neobrutalist welcome card presenting Google OAuth sign-in with fallback notice and an instant Demo Mode launcher.
     - Gated `app/page.tsx` on `!userProfile` with a tactile loading skeleton for smooth transitions.
  3. **Zero-Mock Data Enforcement**:
     - Purged the hardcoded `'Alex'` name from `components/StartFlow.tsx` and removed fake school badges from `components/Header.tsx`.
     - Updated `components/LeaderboardModal.tsx` to handle local demo accounts with an upgrade CTA.
     - Added `components/StartFlow.tsx` and `components/StudentAuthGate.tsx` to `scripts/verify-fake-data-purge.ts`, passing with 0 forbidden strings across 9 audited files.
  4. **Release & Verification**:
     - Rebased on `origin/main` (`feat/user-auth-gate-10180456`), resolved merge conflicts in `StartFlow.tsx`, verified 136/136 tests passing, and executed atomic push to `origin/main` (`c0b5946`).
     - Safely removed the feature worktree.

## Reflection Log Entry - 2026-10-18 (Comprehensive 3D Neobrutalist UI/UX Redesign Across Student Experience)

- **Date**: 2026-10-18
- **Feature**: Comprehensive Student UI/UX Redesign (`components/Header.tsx`, `components/StartFlow.tsx`, `components/QuestionCard.tsx`, `components/RoundSummary.tsx`)
- **Problem & Requirements**:
  - The student quiz interface suffered from visual fatigue, excessive vertical header height (>115px), layout shifts (CLS) when answering, uncomfortable `rounded-full` option pills that clipped multi-line math and economics text, and unorganized settings selectors.
  - The user requested: "use a argon subagent to help you redesign the ui to look nicer."
- **Architecture & Fleet Execution**:
  1. **Argon Architect Blueprinting (`Model="pro"`)**:
     - Diagnosed visual flaws and established 5 core principles: Reclaim vertical headroom (-35px), Zero Layout Shifts (permanently anchored citation badges), Elevated Selection Physics, Ergonomic `rounded-2xl` tactile cards, and Tonal Cohesion.
     - Partitioned implementation cleanly across 2 parallel Flash builders without file overlap.
  2. **Flash Builder 1 (Pre-Quiz & Navigation)**:
     - Compressed `Header.tsx` to `py-2` with uniform `w-9 h-9` circular utility buttons and streamlined XP star / streak fire telemetry.
     - Overhauled `StartFlow.tsx`: elevated 3D mode selection cards with `✓ Selected` chips, unified "Mission Rules" card containing Round Length, Diagram Format, and Timer toggles, and dynamic launch CTA.
  3. **Flash Builder 2 (In-Quiz & Round Recap)**:
     - Upgraded `QuestionCard.tsx`: permanently anchored syllabus citation pills at the top to eliminate CLS, replaced round pills with `rounded-2xl` tactile cards supporting multi-line LaTeX formulas, removed duplicate next buttons, and introduced dedicated explanation panels.
     - Elevated `RoundSummary.tsx`: proportional celebratory score crest (`w-28 h-28 -rotate-3`), expressive 2x2 stats grid, celebratory clean sweep trophy card, and hierarchical action buttons.
  4. **Verification & Worktree Lifecycle**:
     - Verified under `.worktrees/ui-redesign`. Rebased cleanly on `origin/main` (`1267cd1`), resolved merge conflicts in `QuestionCard.tsx`, aligned with test suite expectations.
     - All 136 QA tests in `scripts/verify-revizz.ts` and TypeScript compilation passed cleanly with 0 errors.
     - Pushed atomically to `origin/main` (`4a1e3c8`) triggering automated Vercel deployment. Pruned worktree and branch.

## Reflection Log Entry - 2026-10-18 (Test Compiler A4 Paper Print Optimization & Multi-Page Pagination)

- **Date**: 2026-10-18
- **Feature**: Test Compiler PDF Export A4 Paper Optimization (`components/portal/compiler/PrintableExamLayout.tsx`, `app/portal/compiler/print/page.tsx`, `scripts/verify-revizz.ts`)
- **Problem & Requirements**:
  - Test compiler PDF export was unoptimized for standard A4 paper, cutting questions in half across page boundaries.
  - Teacher Mark Scheme produced an unintended empty blank first page due to premature page break styling.
  - Question diagram images had unconstrained heights causing excessive pagination overflow.
  - Cover sheet and bubble answer sheets lacked strict single-page bounding and layout formatting.
- **Architecture & Solution**:
  1. **Strict A4 CSS Geometry & Print Styling**:
     - Configured `@page { size: A4 portrait; margin: 15mm; }` with `-webkit-print-color-adjust: exact; print-color-adjust: exact;`.
     - Pure white background overrides (`print:bg-white print:p-0 print:m-0 print:min-h-0`) eliminating parent theme interference.
     - Screen preview styled as a true-to-scale A4 sheet (`w-[210mm] min-h-[297mm] mx-auto p-[15mm] shadow-2xl`).
  2. **Single-Page Cover Sheet**:
     - Structured candidate details boxes, barcode, subject title, exam date, and candidate instructions.
     - Enforced `breakAfter: 'page'` and `breakInside: 'avoid'` to guarantee a clean, standalone first page.
  3. **Question Pagination Integrity & Diagram Sizing**:
     - Applied `breakInside: 'avoid'` on all question cards and option item rows to prevent splitting across page margins.
     - Bounded diagram images to `max-h-[190px]` with `object-contain` for reliable fit within A4 vertical flow.
  4. **Compact 1-Page Bubble Sheet**:
     - Starts on a fresh page (`breakBefore: 'page'`).
     - Compact 4-column grid layout (`grid grid-cols-4 gap-x-6 gap-y-2`) fitting up to 40 MCQs cleanly on a single sheet.
  5. **Teacher Mark Scheme Blank Page Elimination**:
     - Fixed blank first page bug by eliminating the redundant initial `pageBreakBefore: 'always'`.
     - Enforced `thead { display: table-header-group; }` for repeating table headers across page breaks and `tr { breakInside: 'avoid'; }`.
  6. **Toolbar & Safe Print Wrapper**:
     - Screen-only (`no-print`) action bar with instant trigger (`window.print()`), mode selector, and A4 print helper tip.
  7. **QA Test Suite**:
     - Added `[Suite 11] Test Compiler A4 Print Layout & Pagination Integrity` to `scripts/verify-revizz.ts`. Full pass: 136/136 tests passing.
  8. **Live Release**:
     - Released to `origin/main` (`1267cd1`) via `npm run wt release test-compiler-a4`.

## Reflection Log Entry - 2026-10-18 (Platform Settings & Account Info Complete Fake Data Purge)

- **Date**: 2026-10-18
- **Feature**: Platform Settings & Account Info Complete Fake Data Purge (`components/admin/AdminSettingsHub.tsx`, `components/admin/AppAdminHub.tsx`, `components/admin/AppAdminNav.tsx`, `components/portal/AdminNav.tsx`, `components/Header.tsx`, `components/portal/compiler/TestCompilerHub.tsx`, `lib/auth.ts`, `scripts/verify-fake-data-purge.ts`)
- **Problem & Requirements**:
  - The user directed: "I want all fake information to be removed from the settings pages. Make sure that all the fake user info, account info are all deleted."
  - Multiple components contained hardcoded dummy data:
    - `AdminSettingsHub.tsx` & `AppAdminHub.tsx`: Fake cohorts (`10A Physics`, `10B Physics`, `11A Physics`, `10 Economics`), fake educators (`Dr. Jane Smith`, `Dr. Marcus Vance`, `Sarah Jenkins`), and artificial seat limits (250/500, expiry 2027).
    - `AdminNav.tsx`: Fake teacher name `'Ms. A. Okafor'` and initials `'AO'`.
    - `Header.tsx`: Fake student name `'Alex M.'` and static badge `"Frontier Int'l"`.
    - `TestCompilerHub.tsx`: Hardcoded defaults (`'Frontier International Academy'`, `'Term 1 Mock Assessment - Economics'`).
    - `lib/auth.ts`: Fake guest educator email `'educator.guest@frontier.edu'`.
- **Architecture & Solution**:
  1. **Settings Zero-State Contracts**:
     - Reset initial `cohorts` and `educators` state to strictly empty arrays `[]`.
     - Added Neobrutalist empty table rows for zero cohorts and zero educators with clear user action guidance.
     - Reset initial quotas to neutral 0 defaults (`totalSeatQuota = 0`, `utilizedSeats = 0`, `teacherSeatLimit = 0`, `licenceExpiry = ''`).
     - Added zero-division guards for quota utilization progress metrics.
  2. **Identity Sanitization Across Portals**:
     - Fallback user names updated to neutral role labels (`Guest Learner`, `Educator`) with matching initials (`GL`, `ED`).
     - Replaced hardcoded school tags with dynamic checks on verified school account credentials (`userProfile.school_name || 'School Member'`), rendering `'Revizz Learner'` otherwise.
     - Defaulted Test Compiler settings inputs to empty strings with clean placeholder guidance.
     - Updated guest educator email domain to `educator.guest@revizz.app`.
  3. **Automated Zero-Mock Audit (`scripts/verify-fake-data-purge.ts`)**:
     - Standalone script asserting 0 occurrences of 11 forbidden dummy strings across all production files.
  4. **Worktree Isolation & Live Release Protocol**:
     - Worktree `remove-fake-info` branched from `origin/main`.
     - Dual-subagent fleet execution across disjoint admin and portal files.
     - Full verification pass (TypeScript 0 errors, 129/129 QA tests passing, 6/6 settings tests passing).
     - Atomic push to `origin/main` (`889b438`) and clean worktree teardown.

## Reflection Log Entry - 2026-10-18 (Student Start Flow Interactive Diagram Filter & Question Pool Partitioning)

- **Date**: 2026-10-18
- **Feature**: Student Start Flow Interactive Diagram Filter (`components/StartFlow.tsx`, `hooks/useQuizGame.ts`, `lib/questions.ts`, `app/page.tsx`, `scripts/verify-diagram-filter.ts`)
- **Problem & Requirements**:
  - The student start flow previously lacked the ability to filter question rounds by format (diagrams vs text-only).
  - The user requested: "user side, add the ability to select diagrams, no diagrams or mixed."
- **Architecture & Solution**:
  1. **Contract & Types (`hooks/useQuizGame.ts`)**:
     - Exported `DiagramFilter = 'mixed' | 'diagrams' | 'no-diagrams'`.
     - Extended `QuizRoundConfig` with `diagramFilter?: DiagramFilter;`.
  2. **Filtering Logic & Pure Helpers (`lib/questions.ts`)**:
     - Created `isDiagramQuestion(q: Question): boolean` detecting diagrams across `has_diagram`, `diagram.has_diagram`, `image_url`, and `diagram.image_url`.
     - Created `filterQuestionsByDiagram(questions, filter)` guaranteeing immutability and fallback resilience.
  3. **3D Neobrutalist UI (`components/StartFlow.tsx`)**:
     - Added 3-button segmented selector (`Mixed` 🔀 with lime accent `#c3f53c`, `Diagrams` 📊 with sunflower accent `#ffdf5d`, `No diagrams` 📝 with neutral chalk `#eceeed`).
     - Added `playPop()` audio physics and local storage persistence (`revizz_last_config`).
  4. **Quiz Runtime & Play Again Loop (`app/page.tsx`)**:
     - Integrated `filterQuestionsByDiagram` in `handleStartStandard` with subject-level fallback if a selected topic lacks diagram questions.
     - Preserved `diagramFilter` across `lastRoundConfig` so "Play Again" respects user settings.
  5. **Verification & Worktree Lifecycle**:
     - Isolated in `.worktrees/diagram-filter` on `feat/diagram-filter-10180430`.
     - Standalone test `scripts/verify-diagram-filter.ts` plus all 127 QA tests and TypeScript passed with 0 errors.
     - Cleanly released to `origin/main` (`e0b7b72`) via `npm run wt release diagram-filter` and pruned with `npm run wt clean`.

## Reflection Log Entry - 2026-10-17 (Admin Question Editor MCQ Options Full-Width Redesign)

- **Date**: 2026-10-17
- **Feature**: MCQ Options Editor Full-Width Redesign & Viewability (`components/portal/AdminCMS.tsx`)
- **Problem & Incident**:
  - The Question Editor's option text input was confined to an artificial fixed `140px` column (`grid-cols-[36px_140px_1fr]`), causing options (e.g. "For whom will we produce...") to be prematurely truncated with ellipses.
  - Distractor misconception reason inputs competed for space on the same row, creating an awkward, cramped layout.
- **Solution & Architecture**:
  - Replaced the single-line row with dedicated, spacious option cards (A-D).
  - Switched option text from single-line `<input>` to full-width multi-line `<textarea rows={2}>` (~700px width), allowing full sentences and LaTeX to wrap naturally without truncation.
  - Indented distractor misconception reason into a dedicated left-bordered block (`ml-12 pl-3 border-l-2`) below the option text.
  - Distractor reasons are hidden on the correct option card, replaced with a prominent `✓ Correct Answer` badge and green accent (`bg-[#f0fae1] border-[#728157]`).
  - Added Suite 6 in `scripts/verify-question-editor.ts` to enforce the removal of the 140px constraint and ensure multi-line `<textarea>` usage.
- **Worktree & Release**:
  - Isolated in `.worktrees/editor-options-viewability`, verified (17/17 editor tests, 127/127 master tests), released to `origin/main` (`249ae7e`), and cleaned up.

## Reflection Log Entry - 2026-10-17 (Admin Question Editor Metadata Expansion & Tagging System)

- **Date**: 2026-10-17
- **Feature**: Question Editor Granular Metadata & Interactive Tagging (`lib/portal/questionMetadata.ts`, `components/portal/AdminCMS.tsx`, `hooks/useQuizGame.ts`)
- **Solutions & Architecture**:
  - Extended `Question` type contract in `hooks/useQuizGame.ts` with optional fields: `year`, `variant`, `series`, `paper_code`, `tags`, `difficulty`, `status`, `subtopic`.
  - Built `lib/portal/questionMetadata.ts` providing `parseCambridgeQuestionMetadata(q)`, `formatCambridgeCitation(meta)`, and Cambridge constant registries.
  - Overhauled metadata box in `AdminCMS.tsx` into 5 structured Neobrutalist sections:
    1. Exam Identity (Subject, Year, Series/Season, Paper Code, Variant, Question #, Difficulty, Status).
    2. Syllabus & Citation (Topic dropdown, Subtopic input, Citation field with one-click "Auto-generate Citation" button).
    3. Tagging & Categorization (Interactive tags with `×` remove button, Cambridge suggestions chips, custom tag entry on Enter).
    4. Diagram Asset (Toggle, Image URL input, and live thumbnail preview).
    5. Formula (LaTeX) & Stem textarea.
  - Live Student Preview displays dynamic citation pills, tag badges, and diagram preview.
- **Worktree & Release**:
  - Worktree `.worktrees/question-editor-fields`, verified (13/13 editor tests, 127/127 QA tests), pushed atomically to `origin/main` (`bbdde48`), and pruned.

## Reflection Log Entry - 2026-10-18 (Unified Admin Settings Tabbed Hub & Portal Harmonization)

- **Date**: 2026-10-18
- **Feature**: Unified Admin Settings Tabbed Hub (`components/admin/AdminSettingsHub.tsx`)
- **Problem & Requirements**:
  - Previously, system and institutional settings were fragmented across disparate routes and individual sidebar buttons (`system`, `school`, ingestion modals, compiler settings), leading to inconsistent navigation and scattered administrative controls.
  - The user requested: "in the admin portal I want all the settings to be in one main page with tabs inside it."
- **Architecture & Solution**:
  1. **Consolidated Component (`components/admin/AdminSettingsHub.tsx`)**:
     - Created a 3D neobrutalist settings console featuring a horizontal tabbed layout across five dedicated panels:
       - **School & Licences** (`school`): Institutional seat progress bar (`250 / 500`), Cambridge cohort roster table, inline cohort registration modal, educator invite triggers, licence term (`Aug 2027`).
       - **System & Telemetry** (`system`): Live platform telemetry, Supabase DB sync badge, Gemini Multimodal OCR status, question bank health, interactive ping & diagnostic actions.
       - **Ingestion & AI Engine** (`ingestion`): Gemini OCR model switcher (`gemini-2.5-flash` / `gemini-1.5-pro` / `gemini-2.5-pro`), 300 DPI crop resolution, KaTeX currency auto-sanitizer toggle, syllabus presets.
       - **Curriculum & Gameplay** (`gameplay`): 2-try Leitner review loop defaults, 50% retry XP, timer modes (`Chill untimed` vs `Exam 90s/Q`), question count presets, sound effects.
       - **Auth & Security** (`auth`): Supabase Google OAuth callback URL with one-click copy, setup guide checklist, Super Admin role gate, Demo/Guest mode toggle.
  2. **Navigation & Router Harmonization (`components/admin/AppAdminNav.tsx`, `app/admin/page.tsx`, `components/admin/AppAdminHub.tsx`)**:
     - Consolidated separate `system` and `school` buttons in `AppAdminNav.tsx` into a single **"Platform Settings"** (`tab='settings'`) navigation item with `Sliders` icon and `5 Panels` badge.
     - Registered `settings: 'Platform Settings'` in `TAB_TITLES` and supported synchronized `sub=<subTab>` deep linking with fallback redirection for legacy `?tab=school` and `?tab=system`.
     - Added quick deep-link button (`⚙️ Full Admin Settings`) in the educator school section of `app/portal/page.tsx`.
  3. **Verification & Testing (`scripts/verify-admin-settings.ts`)**:
     - Built dedicated standalone test suite validating sub-tab contracts, neobrutalist design tokens, and route linkages.
     - All 127 tests in the master QA suite (`scripts/verify-revizz.ts`) and TypeScript compilation passed cleanly with 0 errors.
  4. **Worktree Isolation & Live Release Protocol**:
     - Isolated in `.worktrees/admin-settings-tabs` (`feat/admin-settings-tabs-10172033`).
     - Rebased on `origin/main`, verified gates, and executed atomic push directly to `origin/main` (`fa1ae06`).
     - Verified live production deployment on Vercel (`https://revizz-sand.vercel.app/admin?tab=settings`) returning HTTP/2 200 with the active JS chunk `static/chunks/app/admin/page-2cafb6505a334110.js`.

## Reflection Log Entry - 2026-10-17 (Admin Question Editor Header Simplification)

- **Date**: 2026-10-17
- **Feature**: Direct Question Editor Header Card Removal (`components/admin/AppAdminHub.tsx`)
- **Problem & Context**:
  - In the Admin Question Editor tab (`/admin?tab=editor`), an outer banner card was rendering redundant headers ("Direct Question Editor", Question ID pill, subtitle, and "← Back to Bank" button) above `<AdminCMS initialView="editor" />`.
  - Since `AdminCMS` already includes native question identification, validation status badges, action buttons, and full layout controls, the outer container introduced unnecessary vertical space consumption and visual clutter.
- **Root Cause & Solution**:
  - In `components/admin/AppAdminHub.tsx:case 'editor'`, removed the outer `.space-y-4` wrapper and the `.bg-[#f9f4ed]` banner card (lines 322-346).
  - Directly rendered `<AdminCMS initialView="editor" questionId={selectedQuestionId || questions[0]?.id} />`.
  - Scaffolding verification test in `scripts/verify-admin-editor.ts` to ensure strict contract maintenance.
- **Worktree Isolation & Atomic Release**:
  - Executed worktree creation (`npm run wt create remove-direct-editor-header`), dual-subagent parallel execution, pre-release verification gate (`npx tsc --noEmit` and all 127 tests passing), atomic push directly to `origin/main` (`c9e8144`), and clean worktree teardown.

## Reflection Log Entry - 2026-10-17 (Question Bank Multi-Select Paper Filtering & Inline Dropdown Inspection)

- **Date**: 2026-10-17
- **Feature**: Question Bank Multi-Select Paper Filtering & Inline Dropdown Inspection with Full Editor Navigation
- **Architecture & Solutions**:
  1. **Multi-Select Paper Filtering (`lib/portal/bankFilters.ts`, `components/portal/AdminTools.tsx`)**:
     - Extended `BankFilterState` to support `papers?: string[]` alongside legacy single `paper`.
     - Integrated multi-select chip generation, URL query string serialization/deserialization (`papers=paper1;paper2`).
     - Dynamically synchronized header question count (`X of Y questions`) and status counter tabs (`All`, `Live`, `Agent draft`, etc.) with `filteredBankItems` so counts reflect active filter dimensions instead of the total pool.
  2. **Inline Table Dropdown Inspection Architecture (`components/portal/AdminTools.tsx`)**:
     - Added `expandedQuestionId: string | null` state.
     - Row clicks now expand an inline accordion details card without navigating away from the table.
     - Applied `e.stopPropagation()` to selection checkboxes, delete buttons, and editor triggers to avoid row toggling collisions.
     - Embedded question stem (`<MarkdownErrorBoundary>`), diagram preview thumbnails (`imageUrl`), 4-option cards with green highlight and checkmark on correct answers, distractor reasoning callouts, and key takeaway explanation cards.
     - Dedicated tactile "Open Full Editor ↗" button (`onOpenEditor(item.id)`) allowing teachers to inspect questions inline and jump directly into the full editor.
  3. **Standalone QA Test Architecture & Invariants (`scripts/verify-revizz.ts`)**:
     - Discovered and addressed TS6142 (`--jsx is not set`): Backend Node.js test scripts compiled standalone with `tsc` must not directly import `.tsx` files containing React JSX. Instead, verify code contracts via filesystem audit (`fs.readFileSync`) and algorithmic reference normalizers.
     - Suite 18 verifies `BankQuestionOption` structure, `createInitialBankItems` option mapping, diagram extraction, and UI contract properties.
  4. **Worktree Isolation & Atomic Push Protocol**:
     - Isolated development within `.worktrees/question-table-details`.
     - Validated via `npm run wt verify`, atomic push via `git push origin feat/question-table-details-10171821:main`, and clean worktree teardown.

## Reflection Log Entry - 2026-10-17 (Question Bank Table Viewport & Bulk Actions Layout Ergonomics)

- **Date**: 2026-10-17
- **Feature**: Question Bank Expanded Row Viewport Extension & Bulk Actions Layout Ergonomics
- **Incident & Problem**:
  - The Question Bank table's expanded inline preview (`components/portal/AdminTools.tsx`) cut off question explanations, distractor reasoning, and option cards prematurely.
  - The viewport was constrained to an artificial `max-h-[580px]` scroll container, while the Bulk Agent Actions card occupied prominent vertical real estate immediately below the table rather than letting the question inspection area breathe.
- **Root Cause & Solution**:
  - Expanded the table viewport constraint from `max-h-[580px]` to `max-h-[720px] xl:max-h-[760px] pr-1` in `AdminTools.tsx:1790`, granting ample vertical space for complete explanations and distractor reasoning cards without nested cutoff.
  - Repositioned the Bulk Agent Actions card (`AdminTools.tsx:2084`) cleanly below the extended table container with subtle top margin and soft elevation (`mt-1.5 shadow-xs`).
  - Followed strict Worktree Governance: created `feat/cms-layout-fix-10171915`, ran Dual-Subagent execution (Subagent 1: UI Builder, Subagent 2: Layout QA Verifier), verified clean build (`npx tsc --noEmit` and all 122 tests passing), and released atomically to `origin/main` before worktree pruning.
- **Key Takeaways & UI Invariants**:
  - **Inline Expansion Viewport Budgeting**: Inline inspection tables that render rich markdown, LaTeX, and distractor cards need at least 720px+ vertical headroom (or unconstrained adaptive scrolling) to prevent ugly inner scrollbars and clipped takeaways.
  - **Single Committer Lock Safety**: Always stage and commit within the isolated worktree before invoking `npm run wt release <topic>` to satisfy release cleanliness gates.

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

## Reflection Log Entry - 2026-10-12 (Question Bank UI & Filter/Table Refinement)

- **Date**: 2026-10-12
- **Feature**: Question Bank Session: UI & Functional Refinement
- **Background & Directives**:
  - Overhauling Question Bank UI and functionality within the Admin Portal.
  - User requested a pivot to preserve the original familiar Admin Portal layout structure rather than a radical page replacement, while dramatically enhancing dropdown selection aesthetics, table usability, and filtering UX in-place.
- **Architecture & Components**:
  - **`BankFilterDropdown` component** inside [`components/portal/AdminTools.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/AdminTools.tsx):
    - Custom interactive pill triggers styled in Revizz's neobrutalist aesthetic with warm peach active states (`bg-[#ffe5d9] border-[#2b2b2b]`).
    - Animated Framer Motion popover menus (`initial={{ opacity: 0, y: 6, scale: 0.98 }}`, spring damping).
    - Clear checkmark indicators for active selections, outside-click dismissal (`useRef` + `mousedown` event listeners), and keyboard accessibility (`Escape` key to close).
  - **Multi-Dimensional Filtering Logic**:
    - Filter dimensions: Paper code (e.g., 0455/11, 0455/12), Exam Session (e.g., June 2024, Nov 2023), Syllabus Topic, Difficulty level (Easy, Medium, Hard), Status (all, draft, review, published), and instant text search across question content and IDs.
    - Bidirectional synchronization between Status counter tabs and the Status dropdown filter.
  - **Table Performance & Layout**:
    - 20-item page slicing (`pageSize = 20`) with dynamic total page calculation to keep DOM lightweight and render snappy.
    - Sticky table header (`sticky top-0 z-10 bg-[#f9f4ed]`) with clean bottom border for persistent column alignment during vertical scrolling.
    - Dedicated vertical scroll viewport (`max-h-[580px] overflow-y-auto`) preserving portal context.
    - Subtle, responsive footer pagination controls with disabled boundary handling and current item range indicator (`Showing X-Y of Z questions`).
- **Reflexion & Anti-Pattern Takeaways**:
  - **User Layout Anchoring**: When enhancing existing portal tools, prefer enhancing components and UX in-place rather than full page replacements unless explicitly requested by the user. Maintain cognitive familiarity while upgrading aesthetics and ergonomics.
  - **Next.js Dev Cache Collision**: Running `next build` concurrently with an active `next dev` background process invalidates development manifests and throws transient HTTP 500 errors in browser navigation. Terminating stale dev server processes and performing clean server reboots resolves manifest corruption immediately.
  - **Zero Unverified Handoffs**: Always enforce rigorous multi-layer verification before marking tasks complete: strict TypeScript checks (`npx tsc --noEmit`), automated test suites (`npm test` — 31/31 passing), and live deployment/remote probing where applicable.

## Reflection Log Entry - 2026-10-12 (Ingestion Studio UI/UX Streamlining & Layout Architecture)

- **Date**: 2026-10-12
- **Feature**: Ingestion Studio Architecture & UI/UX Streamlining Redesign
- **Key Lessons & Architectural Principles**:
  1. **Button Fatigue Reduction via Hierarchical Action Pruning**:
     - *Issue*: Header toolbars cluttered with 6-8 scattered buttons (Preset, Upload, Payload, Settings, Audit, Preview, Publish) created visual noise and cognitive hesitation.
     - *Solution*: Relegated secondary utilities into a single neobrutalist `[···]` overflow dropdown menu. Elevated only two high-frequency actions as primary CTAs: `[👁 Preview]` (teal toggle) and `[Push Live]` (green action). Replaced noisy status text with a subtle, traffic-light health indicator dot (`#22C55E` ≥90%, `#FACC15` 50-89%, `#FB7185` <50%).
  2. **2-Column Focus Layout vs. 3-Column Splits on Laptop Viewports**:
     - *Issue*: A permanent 3-column split (`Question Nav` | `Stem/Options Editor` | `Student Simulator Preview`) crushed the authoring workspace on standard 13"–15" laptop screens (<1440px wide). Input fields wrapped erratically, and KaTeX equations were truncated.
     - *Solution*: Shifted to an asymmetric 2-column layout: Left Navigation matrix (~22% width, 240px–320px) and a spacious Main Authoring Canvas (~78% width). This maximizes horizontal room for multi-line stems, KaTeX formula previews, and 4 stacked option cards.
  3. **Slide-Over Preview Drawer for On-Demand Validation**:
     - Instead of consuming fixed horizontal real estate, the interactive Gameboy student simulator and 7-point QA diagnostics reside inside a fixed 540px slide-over drawer (`fixed inset-y-0 right-0 z-50`). Curators open it with `[👁 Preview]` to test the 2-try mastery loop and dismiss it with `Escape` or backdrop click without losing editing state.
  4. **Progressive Disclosure Accordions for Media & Derivations**:
     - *Issue*: Questions without figures still showed empty image dropzones and diagram inputs, pushing syllabus topics and derivation explanations far below the fold.
     - *Solution*: Implemented smart collapsible accordions in `IngestionMediaPanel.tsx`. The Diagram & Figures accordion defaults to collapsed when `has_diagram` is false, but automatically expands when image assets exist. The Syllabus Topic & Derivation accordion remains open with tabbed views (`Split`, `Edit`, `Preview`).
  5. **Rapid Keyboard Ergonomics for High-Throughput Curation**:
     - Integrated hotkeys (`1-4` or `A-D` to designate correct answers, arrow keys to navigate questions) with input suppression checks (`target.tagName !== 'INPUT'/'TEXTAREA'`), allowing curators to validate 30-question past papers without repetitive mouse travel.

## Reflection Log Entry - 2026-10-12 (In-Quiz Experience Overhaul, Framer Motion Spring Traps, & Worktree Resiliency)

- **Date**: 2026-10-12
- **Topic**: In-Quiz Experience Overhaul, Framer Motion Spring Keyframe Crashes, & Worktree Orchestration
- **Context & Objectives**:
  - Enhancing the active in-quiz experience inside an isolated git worktree (`feat/quiz-card-ux`) to allow reversible UI experimentation.
  - Enriching Cambridge question explanations with LaTeX formulas and distractor analysis while refactoring `QuestionCard` with 3D tactile buttons, diagram lightbox, and progressive feedback.

### 1. Incident & Root Cause Analysis (Framer Motion Spring Trap)
- **Incident**: Selecting the correct answer on Question 3 during quiz playback triggered an uncaught runtime exception:
  `Error: Only two keyframes currently supported with spring and inertia animations. Trying to animate 1,1.025,1`.
- **Root Cause**:
  - In Framer Motion / Motion, transform channels (`scale`, `x`, `y`, `rotate`) default internally to `type: "spring"` if unspecified.
  - Supplying `{ duration: 0.3, ease: 'easeOut' }` without an explicit `type: "tween"` does **not** override or unset the internal spring type default.
  - When Motion evaluates 3 or more keyframes on a transform property (e.g. `scale: [1, 1.025, 1]` or pulse bounces), the spring solver fails and throws a fatal runtime exception.
- **Rule & Remediation**:
  - Whenever defining array-based keyframes (>= 3 values) on transform attributes, **always** explicitly declare `type: "tween"`, e.g.:
    ```tsx
    transition={{
      type: "tween",
      duration: 0.3,
      ease: "easeOut"
    }}
    ```
  - Prefer using Framer Motion variants or `animate={{ ... }}` with strict tween transitions for multi-step tactile pulses.

### 2. UI Resilience Anti-Pattern: Cascading Render Crashes
- **Anti-Pattern**:
  - The runtime crash inside the child option card animation unmounted React's entire QuestionCard component tree.
  - Because progression controls ("Next question", "Skip", "Exit") were co-located inside the unmounting container, the crash destroyed the user's escape hatch and trapped them on a broken view.
- **Architectural Solution**:
  - **Decoupled Action Rails**: Progression buttons and session state controls must reside outside child presentation cards or be anchored in an independent persistent action rail.
  - **Targeted Error Boundaries**: Wrap rich interactive components (KaTeX math renderers, dynamic markdown containers, option micro-animations) in defensive error boundaries (e.g., `MarkdownErrorBoundary`). If a child rendering exception occurs, render a graceful fallback while leaving navigation and quiz progression intact.

### 3. Worktree & Dev Server Daemon Orchestration Protocol
- **Lessons Learned**:
  - **Port & Process Isolation**: When executing experiments in dedicated git worktrees, distinct dev ports (`3000` vs `3001`) must be tracked alongside the operating process directory (`cwd`).
  - **Daemon Teardown Before Worktree Removal**: Never remove a git worktree directory while a Next.js dev server daemon is still running from that path. Always terminate the background process first (`lsof -ti :3001 | xargs kill -9` or task manager termination), then cleanly prune and remove the worktree:
    ```bash
    git worktree remove --force <worktree-path>
    git branch -D feat/quiz-card-ux
    ```
  - **Main Branch Alignment**: Verify repository cleanliness (`git status`) and re-establish the primary development server cleanly on port 3000 against `origin/main`.

### 4. Verification Gap: Static Analysis vs. Runtime Physics
- **The Gap**:
  - `npx tsc --noEmit` and static test suites passed completely because Motion prop types technically accept `number[]` for scale keyframes. TypeScript cannot validate Framer Motion's internal runtime animation constraints.
- **Subagent Verification Protocol**:
  - Subagents implementing UI motion or dynamic rendering must write runtime render assertion tests (using React Testing Library, triggering answer clicks or state changes) to assert that component state transitions do not throw runtime exceptions.

## Reflection Log Entry - 2026-10-12 (Question Flow UX, Cognitive Bias Mitigation & Self-Paced Learning Architecture)

- **Date**: 2026-10-12
- **Topic**: Question Flow UX, Cognitive Bias Mitigation & Self-Paced Learning Architecture
- **Context & Decisions**:
  1. **Progressive Metadata Disclosure**: Hiding paper citations, subject codes, and topic badges until the first answer attempt (`status !== 'unanswered'`) prevents cognitive bias and syllabus giveaways. Lightbox modal titles and image alt tags must also sanitize citations when unanswered.
  2. **Pacing Control vs. Auto-Skip**: Disabling automatic progression timeouts (`1500ms`) on correct answers. Instead, place the primary Next Question CTA directly on top of the explanation panel. This allows fast students to advance instantly while providing curious students unhurried access to step-by-step explanations and distractor analysis. A secondary CTA at the bottom prevents awkward reverse-scrolling.
  3. **Round Summary Hierarchy**: Placing the "Review missed questions" CTA directly above the missed questions list prioritizes action over scrolling.

## Reflection Log Entry - 2026-10-12 (Cambridge Ingestion System v2 Rework & Orchestrator Governance)

- **Date**: 2026-10-12
- **Feature**: Cambridge Past Paper Ingestion System v2 Architecture & Orchestrator Governance
- **Context & Scope**: Complete overhaul of the Cambridge Examination Ingestion Pipeline, transforming manual CLI execution and JSON paste modals into a modern, web-first Ingestion Studio with dual-pane PDF split-screen, interactive visual cropper, and live 6-point quality gate.

### 1. Multi-Subagent Orchestration & Race Condition Mitigation
- **Strict Exclusive File Partitioning**: By partitioning the codebase across 3 milestones and assigning 100% disjoint sets of files to subagents (A1, A2, A3 in Milestone 1; B1, B2, B3, B4 in Milestone 2; C1, C2 in Milestone 3), concurrent execution proceeded with zero merge collisions or race conditions.
- **Bundled Verification Contract (DoD)**: Forcing subagents to compile (`npx tsc --noEmit`) and run targeted unit tests within the same invocation before signaling completion eliminated downstream integration surprises.
- **Passive Turn-Ending & Zero-Polling**: Strict avoidance of polling commands (`manage_subagents` list polling or background task loops) conserved context tokens and streamlined execution.

### 2. Technical & Architectural Breakthroughs
- **Next.js App Router Server-Sent Events (SSE)**:
  - Building `/api/ingest/extract` using standard `ReadableStream` with `text/event-stream` encoding allows long-running batch Gemini OCR to stream incremental question extractions directly to the browser with real-time percentage indicators.
  - Implemented an `AbortController` signal consumer on the client (`useIngestionStore`) to allow curators to halt extraction without thread hanging.
- **Dual-Pane Synchronized Inspection & Visual Cropper**:
  - Synchronizing `selectedIdx` in the question nav directly with `page_number` in the PDF canvas (`IngestionPdfViewer`) eliminates manual flipping between question items and source pages.
  - The 8-handle interactive bounding box overlay normalizes coordinates into canonical `[0..1000]` space, feeding directly into the serverless-safe `/api/ingest/crop` route powered by in-memory `sharp` and Supabase Storage.
- **KaTeX Typography Defense & Currency Protection**:
  - Currency dollar signs (`$50`, `$100 to $150`) frequently break LaTeX parsers by being mistaken for unclosed inline math blocks.
  - Protecting currency with regex lookaheads while normalizing exponents (`10^-5` -> `10^{-5}`), fractions, and Greek symbols guarantees zero KaTeX renderer crashes.
- **6-Point Quality Gate & Interactive Field Jump**:
  - Real-time evaluation of question count, 4-option population, single correct answer parity, KaTeX syntax integrity, diagram uploads, and syllabus mapping produces an actionable 0–100% paper health score with one-click DOM focus.

## Reflection Log Entry - 2026-10-12 (Ingestion Studio UI De-cluttering & Question Bank Visual Harmonization)

- **Date**: 2026-10-12
- **Feature**: Ingestion Studio UI De-cluttering & Question Bank Visual Harmonization
- **Key Insights**:
  1. **Visual Consistency & Cognitive Load**: Transitioned from saturated neobrutalist styling (harsh borders, high-contrast neons) to the Question Bank's calm, organic palette (`#f5ead8`, `#f9f4ed`, `#dcd3c4`, `#c67139`, `#ffe1d0`, `#728157`). This significantly reduced visual clutter and improved legibility for content curators.
  2. **Modal Popups vs Layout-Shifting Drawers**: The previous 540px slide-over drawer squeezed the workspace (`2xl:mr-[550px]`) and caused horizontal layout pressure. Refactoring it into a clean modal popup (`IngestionPreviewModal.tsx`) with Card View and Interactive Test modes provided dedicated focus without distorting the primary editor canvas.
  3. **Clean Multi-Subagent Execution**: Successfully partitioned tasks into disjoint file sets (Hub/Header/Modal, QuestionNav, Authoring Suite) with bundled verification (`npx tsc --noEmit`) and zero polling.

## Reflection Log Entry - 2026-10-12 (Ingestion Studio Layout Unification & Seamless PDF Upsert Architecture)

- **Date**: 2026-10-12
- **Feature**: Live Ingestion Studio Layout Redesign & Unification into Master Studio Frame
- **Problem & Motivation**:
  1. **Dual-Island Anti-Pattern**: A disconnected floating top header and a separate wizard card stacked vertically created confusion, displaying premature workspace controls (phantom `0 Questions`, disabled `Upsert to Supabase`, `Hide PDF`) when no paper was loaded.
  2. **Forced Default Preset**: Blank states auto-loaded sample preset `0455_s24_12`, blocking curators from seeing the initial PDF upload dropzones and metadata selection.
  3. **Nested Box Fatigue**: Multiple layers of outer borders, shadows, and margins reduced usable editing real estate on laptop viewports.
- **Solution & Architectural Pattern**:
  1. **Master Studio Frame (`IngestionStudioFrame.tsx`)**: Single master bounding container (`border-2 border-[#201e1d] shadow-[4px_4px_0_#201e1d] rounded-3xl bg-[#f9f4ed]`) providing a cohesive home for the entire ingestion journey.
  2. **State-Aware Contextual Header (`IngestionHeader.tsx`)**: Dynamically switches between:
     - *Setup Mode*: Displays pipeline tag, title, preset quick-load, and return-to-session button; completely eliminates phantom counters and disabled buttons.
     - *Workspace Mode*: Displays paper identity pill (`0455 / 12 · Economics Summer 2024`), live validation counters (`X/Y Valid ✓`, `Z Review ⚠`), split PDF toggle, save draft, and prominent Supabase upsert button.
  3. **Internal Notification Shelf**: Embedding live extraction progress bars and validation feedback toasts directly inside the master frame eliminated Cumulative Layout Shift (CLS).
  4. **Modular Sub-Components**:
     - `IngestionSetupWizard.tsx`: Streamlined 2-step setup with on-screen metadata selectors (Subject, Year, Series, Paper Code) and QP/MS PDF dropzones.
     - `IngestionWorkspace.tsx`: Docked dual-pane studio pairing the collapsible Cambridge PDF viewer with a horizontal question navigation strip (1..40) and active question authoring canvas.
  5. **Client-Side Validation Guard for Upserts**: Pre-validates stems, option count (4), and single correct answer parity before hitting `/api/ingest/publish`. If invalid, automatically jumps to the first broken question with an actionable alert.
- **Verification & Deployment**:
  - `npx tsc --noEmit`: 0 errors.
  - Automated test suites: `npm test` (37/37 passed), `verify-ingestion-v2.ts` (125/125 passed).
  - Production build: `next build` passed with all 10 routes cleanly generated.
  - Deployed cleanly to `origin/main` (commit `5f7fc95`).

## Reflection Log Entry - 2026-10-12 (Question Compiler Layout Reorganization & Multi-Dimensional Filter Engine)

- **Date**: 2026-10-12
- **Feature**: Question Compiler & Exam Generator Layout Redesign & Advanced Search/Filter Suite
- **Context & Motivation**:
  - Reorganizing the Question Compiler / Exam Generator into a high-density, front-and-center question bank canvas with unified sticky right-hand controls.
  - Equipping educators and curators with an instant multi-dimensional filter engine (`lib/compilerFilters.ts`) to slice, search, and assemble past-paper tests effortlessly.

### 1. Layout & Workspace Architecture
- **Front-and-Center Question Bank Viewport**:
  - Allocated primary visual hierarchy to the question pool with an expansive dedicated scrollable container (`h-[calc(100vh-140px)] min-h-[650px] overflow-y-auto pr-2`).
  - Added a clear semantic heading (`<h2>`) labeled "Test Compiler" alongside real-time persistent question selection metrics.
  - Eliminated redundant outer title and subtitle banners, removing unnecessary vertical scroll padding and keeping critical question stems above the fold on 13"–15" laptop screens.
- **Sticky Right-Column Controls**:
  - Anchored test assembly controls in a sticky right rail (`lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] overflow-y-auto`).
  - Unified search input, quick presets, saved drafts, and the Test Assembly drawer into a consolidated side panel, keeping compilation controls accessible regardless of vertical scroll depth.

### 2. Multi-Dimensional Filter Architecture (`lib/compilerFilters.ts`)
- **Selection Status Segmentation**:
  - Segmented question views into `All`, `Selected in Test`, and `Unselected` states with dynamic live count badges.
- **Dynamic Cambridge Exam Series & Year Extraction**:
  - Automatically parses Cambridge exam series (February/March, May/June, October/November) and exam years from question citations and IDs for dynamic dropdown filtering.
- **Content & Format Toggles**:
  - *With Diagrams*: Filters for visual items containing `image_url`.
  - *With Data Tables*: Identifies tabular markdown data structures (`|` pipes).
  - *Calculations & Math*: Detects KaTeX math delimiters (`$...$`, `$$...$$`), currency expressions (`$100`), and numerical calculation questions.
- **Multi-Option Sorting**:
  - Supports ordering by original paper sequence, shortest conceptual stems (rapid-fire recall), and longest scenario/case-study stems.
- **Ergonomics & Reset Action**:
  - Displays real-time active filter count badges with a one-click "Reset All" action to restore baseline views instantly.

### 3. Bug Patterns & Pre-Deploy Hardening
- **Header Syntax Guard**:
  - Resolved an unclosed ternary expression in header rendering logic that caused SWC/webpack build workers to hang and throw parse errors.
- **Interface Parity Across Component Boundaries**:
  - Synchronized component prop interfaces (`AdminNavProps`) with parent page callers (`app/admin/compiler/page.tsx`), preventing TypeScript contract mismatches during `next build`.
- **Stale Build Cache Mitigation**:
  - Cleared the `.next` compilation cache directory when App Router manifests diverged across rapid multi-file refactoring steps to avoid transient compilation failures.

### 4. Verification & Definition of Done
- **Type Safety**: Full TypeScript validation pass (`npx tsc --noEmit` exit code 0).
- **Test Coverage Expansion**: Added Suite 7 to `verify-revizz.ts` validating all filter conditions, regex extractors, sorting mechanisms, and state transitions (40/40 assertions passing).
- **Production Build**: Next.js production build (`next build`) succeeded with all static/dynamic routes cleanly compiled.
- **Remote Synchronization**: Safely committed and pushed to `origin/main` (commit `8785fe8`).

## Reflection Log Entry - 2026-10-12 (Test Compiler Layout Overhaul: Horizontal Sticky Filter Toolbar & Dedicated Assembly Drawer)

- **Date**: 2026-10-12
- **Topic**: Test Compiler Layout Overhaul (Option 3: Horizontal Sticky Filter Toolbar & 100vh Dedicated Test Assembly Drawer)
- **Problem & Viewport Budget**:
  - Previously, Card B (Filters) and Card C (Test Assembly Drawer) were vertically stacked in a 420px right rail.
  - Their combined height totaled 1100px–1250px, which severely exceeded laptop 100vh screens (>350px overflow beyond the fold).
  - Users were forced to constantly scroll the right sidebar to access essential compilation controls, and the primary action CTAs ("Save Draft", "PDF / Print") were repeatedly pushed completely off-screen.

- **Solution Architecture (Option 3)**:
  1. **Horizontal Sticky Filter Toolbar**:
     - Relocated Search & Filters into an expansive horizontal sticky toolbar (`sticky top-0 z-10 backdrop-blur-sm`) directly positioned above the question feed.
     - Divided into two high-density ergonomic rows:
       - *Top Row*: Live question counter badges, Quick Action buttons ("Auto-Generate Preset", "Saved Drafts", "Clear Selection"), full-width search input with instant clear button, and "Reset All" active filter trigger.
       - *Bottom Controls Row*: Dropdowns for Topic, Exam Series / Year, and Stem Sorting, alongside Selection Status pills (`All`, `Selected`, `Unselected`) and Content Format toggles (`Diagrams`, `Tables`, `Math / Calc`).
  2. **Dedicated 100vh-Compliant Test Assembly Drawer**:
     - Redesigned the right column into an exclusive, dedicated Test Assembly Drawer (`flex flex-col p-5 rounded-3xl bg-[#f9f4ed] border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] overflow-hidden`).
     - *Collapsible Settings Accordion*: Layout & Settings panel is collapsible with an internal constrained scroll viewport (`max-h-[35vh] overflow-y-auto`) so configuring paper metadata or toggling bubble sheets/mark schemes never pushes the bottom CTAs off-screen.
     - *Flexible Question Reordering List*: Sized with `flex-1 min-h-0 overflow-y-auto`, enabling smooth scrolling through chosen questions regardless of test length.
     - *Pinned Action Footer*: Fixed at the bottom (`shrink-0 mt-auto pt-3 border-t-[1.5px] border-[#dcd3c4]`) ensuring "Save Draft" and "PDF / Print" CTAs remain permanently visible and accessible at all times without scrolling.

- **Learnings & Viewport Height Tuning**:
  - When embedding a persistent 100vh sticky rail within a portal layout featuring top headers (`h-16`) and outer padding, calculating drawer height strictly as `100vh-32px` causes the footer to touch or bleed beneath the browser bottom bar.
  - Adjusting container height to account for navbar and breadcrumb offsets (`h-[calc(100vh-130px)] max-h-[calc(100vh-130px)]`) grants critical breathing room above the screen edge, preserving perfect 100vh viewport compliance on all 13"–16" laptop displays.

- **Verification & Definition of Done**:
  - TypeScript validation: `npx tsc --noEmit` passed with 0 errors.
  - Automated test suites: `npm test` passed with 40/40 tests passing (`verify-revizz.ts`).

## Reflection Log Entry - 2026-10-12 (Teacher vs App Admin Architectural Separation, Dual Design System, & Navigation Ergonomics)

- **Date**: 2026-10-12
- **Topic**: Teacher vs App Admin Architectural Separation, Context-Sensitive Dual Design System, Sidebar Ergonomics & Live Production Deployment

### 1. Teacher Portal (`/portal`) vs App Admin Console (`/admin`) Partitioning
- **Architectural Motivation & Role Separation**:
  - Educational workflows and platform operations have fundamentally different operational personas and security boundaries. Blending them into a single monolithic "Admin" interface creates cognitive friction, permission bloat, and UI compromises.
  - **Teacher Portal (`/portal`)**: Focused on pedagogical workflows and student cohort supervision:
    - Student management & class roster tracking (`/portal/students`).
    - Granular cohort & individual performance analytics (`/portal/stats`).
    - Curriculum question verification and tagging (`/portal/questions`).
    - Physical and digital worksheet compilation (`/portal/test-compiler`).
    - Homework assignment dispatch and deadline tracking (`/portal/homework`).
  - **App Admin Console (`/admin`)**: Dedicated to system infrastructure, data ingestion pipelines, and platform operations:
    - Cambridge exam paper ingestion studio (`/admin/ingest`).
    - Staged paper extraction review & OCR verification (`/admin/staged`).
    - Database and platform diagnostics (`/admin/diagnostics`).
    - Edge function telemetry and overall system health.
- **Route Handling & `AppShell.tsx` Layout Partitioning**:
  - Modified `src/components/layout/AppShell.tsx` to detect both teacher and admin route prefixes (`isTeacherPortal = pathname.startsWith('/portal')`, `isAdminConsole = pathname.startsWith('/admin')`).
  - Implemented unconstrained, edge-to-edge canvas rendering (`w-full min-h-screen`) across both portals, bypassing the fixed-width phone/tablet container constraint (`max-w-[480px]`) reserved exclusively for the student mobile gameplay view.

### 2. Context-Sensitive Dual Design System (Playful Student vs Professional Admin)
- **Why Uniform Visual Overhauls Fail in EdTech**:
  - In gamified learning applications, applying a single visual aesthetic across all surfaces fails both user personas.
  - Students require high-engagement, tactile, and motivating micro-interactions: bold borders (`border-4 border-[#201e1d]`), bouncy spring animations, cheerful color blocks (`#fef08a`, `#ffc480`, `#bbf7d0`), chunky 3D neobrutalist drop shadows (`shadow-[6px_6px_0px_#201e1d]`), and whimsical typography (`Caprasimo`).
  - Educators and platform engineers require high-density, serious command-deck layouts: dense tabular data, tabular numbers, precise telemetry, low-latency navigation, and understated borders that maximize data visibility without visual fatigue.
- **Dual-Token Coexistence Architecture**:
  - Preserved `--font-heading` (`Caprasimo`, display serif/chunky cartoon aesthetic) specifically for student quiz loops, reward modals, and streak animations.
  - Introduced `--font-admin-heading` (`Space Grotesk`) and paired with `--font-mono` (`JetBrains Mono`) for admin/teacher headers, stat cards, metric counters, and telemetry data tables.
  - Tokenized color variables to allow high-contrast, clean status pills in admin interfaces (`bg-emerald-50 text-emerald-700 border-emerald-300`, `bg-amber-50 text-amber-700 border-amber-300`) while maintaining vibrant pastel fills for student cards.

### 3. Sidebar Navigation Layout Bug Pattern & Resolution
- **The "Ugly Squished Badge" Incident**:
  - *Symptom*: When rendering admin navigation links inside a narrow `w-[250px]` flexbox container, badges containing literal bracket notation and uppercase text (e.g., `[ 1 STAGED ]`, `[ OCR/KaTeX ]`) triggered unexpected multi-line wrapping.
  - *Root Cause*: Lack of flex container bounds, unconstrained badge widths, and un-truncated navigation labels forced badges onto second and third lines, blowing up row heights, misaligning adjacent icons, and severely disrupting visual hierarchy.
- **Architectural Resolution & Navigation Ergonomics**:
  - **Sidebar Expansion**: Expanded the sidebar width from `w-[250px]` to `w-[264px]`, granting adequate breathing room for multi-item labels and badges.
  - **Fixed Icon Bounding Frames**: Encapsulated navigation icons in uniform 7×7 (`w-7 h-7`) fixed-size flex containers with centered alignment, eliminating vertical shift when labels wrap or adjust.
  - **Text Truncation & Label Hierarchy**: Applied `truncate` and `min-w-0` to route label spans, ensuring long text gracefully clips rather than breaking container flex rows.
  - **Sleek Status Pills**: Replaced bracketed text with compact, rounded badge pills:
    - Dynamic count pill: `1 staged` (`bg-[#ffeb80] text-[#201e1d] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#201e1d]`).
    - Telemetry status: Pulsing emerald dot (`Live`) with `w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse`.
    - Compact circular bubbles: Fixed circular badge `8` (`w-5 h-5 flex items-center justify-center rounded-full bg-[#f4ebe1] text-[11px] font-bold`).

### 4. Verification & Live Production Deployment
- **Bundled Verification Contract**:
  - Automated test suite execution: `npm test` verified with 40/40 tests passing (`verify-revizz.ts`).
  - Type safety audit: `npx tsc --noEmit` passed cleanly with 0 TypeScript errors.
  - Production build verification: `next build` compiled cleanly across all 10/10 static and dynamic routes.
- **Git & Live Vercel Production Release**:
  - Clean atomic commits pushed to `origin/main` (`cc70066..c09a046`).
  - Production deployment verified live and accessible at `https://revizz-sand.vercel.app`.

## Reflection Log Entry - 2026-10-12 (Comprehensive Systems & Codebase Audit: Motion Spring Trap Remediation & Defensive Error Boundaries)

- **Date**: 2026-10-12
- **Topic**: Comprehensive Systems & Codebase Audit: Framer Motion Spring Trap Remediation, Defensive Markdown Error Boundaries, and Dual Design System Verification
- **Auditor**: Principal Systems & Codebase Auditor (Pro Tier)

### 1. Framer Motion Multi-Keyframe Spring Trap Remediation (`Header.tsx`)
- **Audit Finding**:
  - Scanning the codebase for multi-keyframe transform arrays revealed a critical latent spring crash in `components/Header.tsx` (lines 114-117 and 127-130).
  - Streak and XP indicator pills animated `scale: [1, 1.25, 1]` with `{ type: 'spring' as const, stiffness: 500, damping: 15 }`.
  - Motion's spring solver internally throws a fatal runtime exception (`Error: Only two keyframes currently supported with spring and inertia animations`) whenever three keyframes are animated under a spring transition.
- **Architectural Remediation**:
  - Replaced the spring configuration with `{ type: 'tween', duration: 0.3, ease: 'easeOut' }`.
  - Preserved the snappy tactile pulse effect while eliminating all risk of fatal uncaught runtime crashes when streaks or XP update during student gameplay.

### 2. Defensive UI Resilience: `MarkdownErrorBoundary`
- **Audit Finding**:
  - Unsanitized OCR output and complex KaTeX math formulas in Cambridge economics past papers can contain syntax anomalies (e.g. unescaped dollar signs, unclosed delimiters).
  - Previously, `ReactMarkdown` with `remark-math` and `rehype-katex` rendered directly within components without defensive boundaries. A parsing failure would crash React's component tree, destroying quiz progress or curation state.
- **Architectural Implementation**:
  - Implemented `components/ui/MarkdownErrorBoundary.tsx`, a robust React Error Boundary that catches LaTeX/Markdown render exceptions and presents a clean inline alert without unmounting the surrounding interface.
  - Integrated `MarkdownErrorBoundary` across high-risk dynamic rendering zones:
    1. `components/QuestionCard.tsx`: Wrapped both question stem and option text choices.
    2. `components/portal/IngestionPreviewModal.tsx`: Wrapped question stem, option choices, and official mark scheme derivations.
    3. `components/portal/compiler/TestCompilerHub.tsx`: Wrapped test question stems and option choices in the compilation pool.

### 3. Portal Partitioning & Dual Design System Audit
- **Teacher Portal (`/portal`) vs. App Admin (`/admin`)**:
  - Clean separation confirmed: pedagogical workflows (Roster, Assignments, Test Compiler, Question Bank) are isolated to `/portal`, while pipeline infrastructure (Ingestion Studio v2, Staged Papers, Diagnostics) is partitioned to `/admin`.
  - Sidebar navigation ergonomics in both `AdminNav.tsx` and `AppAdminNav.tsx` strictly follow the architectural standard: `w-[264px]` width, uniform `w-7 h-7` icon frames, `truncate` and `min-w-0` on labels, and rounded pill badges with `shrink-0 whitespace-nowrap` preventing line wrapping.
- **Dual Design System Token Alignment**:
  - Student gameplay surface (`/`): Framed mobile/tablet canvas via `AppShell.tsx`, playful `Caprasimo` typography, 3D neobrutalist borders (`border-4 border-[#201e1d]`), tactile drop shadows (`shadow-[6px_6px_0_#201e1d]`), and bright reward tokens.
  - Admin & Teacher console (`/portal`, `/admin`): Full-width unconstrained canvas via `AppShell.tsx`, professional `Space Grotesk` headers, `JetBrains Mono` telemetry indicators, and calm, organic tones (`#f5ead8`, `#f9f4ed`, `#dcd3c4`, `#c67139`).

### 4. Test Compiler & Ingestion Studio v2 Compliance
- **Test Compiler**:
  - Adheres strictly to Option 3 layout architecture: horizontal sticky filter bar (`sticky top-0 z-10 backdrop-blur-sm`), dedicated 100vh-compliant Test Assembly Drawer (`h-[calc(100vh-130px)]`), collapsible settings accordion (`max-h-[35vh]`), and permanently pinned action footer (`Save Draft`, `PDF / Print`).
- **Ingestion Studio v2**:
  - Unified into Master Studio Frame (`IngestionStudioFrame.tsx`).
  - State-aware `IngestionHeader.tsx` correctly distinguishes Setup Mode from Workspace Mode.
  - Client-side validation guard in `IngestionHub.tsx` verifies stem, option count (4), and single-correct answer parity prior to triggering Supabase upserts, auto-jumping to broken items with actionable diagnostics.

### 5. Verification & Definition of Done
- **Expanded Test Suite**:
  - Added `[Suite 9] Dynamic Resilience & Framer Motion Keyframe Integrity` to `scripts/verify-revizz.ts`.
  - Total automated assertions: 47/47 passing (100% pass rate).
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
- **Local Git Repository Status**:
  - All modifications staged and committed locally under clean semantic conventions.
  - Remote repository push held per strict Rule 10 constraints.

## Reflection Log Entry - 2026-10-12 (Ingestion Setup Header Streamlining & Worktree Live Release)

- **Date**: 2026-10-12
- **Topic**: Ingestion Setup Header Redundancy Removal, Worktree Isolation & Atomic Release
- **Context & Problem**:
  - The Ingestion Studio frame (`IngestionStudioFrame.tsx`) previously rendered a docked top header card via `IngestionHeader.tsx` even in `setup` mode.
  - In `setup` mode, `IngestionSetupWizard.tsx` already contains its own dedicated header banner with paper metadata, subject presets, and session navigation.
  - This caused visual duplication, rendering an extraneous neobrutalist card ("CAMBRIDGE MULTIMODAL PIPELINE / Gemini Vision 2.5 Ingestion / Digitize & Upsert Past Exam Papers") above the wizard.

### 1. Architectural Insights & Solutions
- **Component Role Decoupling**:
  - `IngestionHeader.tsx` is specialized strictly for the active curation studio (`workspace` mode: paper identity pill, health score, validation counters, undo/redo, and Push Live CTA).
  - In `setup` mode, `IngestionHeader.tsx` returns `null`, and `IngestionHub.tsx` conditionally passes `header={mode === "workspace" ? <IngestionHeader ... /> : null}`.
  - This eliminates container nesting bloat and lets `IngestionSetupWizard.tsx` own the full initial viewport cleanly.

### 2. Worktree Isolation & Atomic Release Protocol
- **Git Worktree Workflow**:
  - Feature work was isolated in `.worktrees/ingestion-header-clean` branched directly from `origin/main`.
  - Shared assets (`node_modules`, `.env.local`, `.vercel`) were symlinked into the worktree.
  - Re-verified via `npx tsc --noEmit` (0 errors), `verify-ingestion-v2.ts` (125/125 passed), and `verify-revizz.ts` (56/56 passed).
- **Production Deployment**:
  - Pushed atomically via `git push origin feat/ingestion-header-clean:main` (commit `faf5c70`).
  - Triggered and verified live Vercel production deployment (`https://revizz-sand.vercel.app`).
  - Completed clean worktree teardown and pruned the feature branch.

## Reflection Log Entry - 2026-10-13 (Teacher Portal & Admin Sidebar Grid Architecture & Release)

- **Date**: 2026-10-13
- **Topic**: Teacher Portal & Admin Sidebar Grid Synchronization, Tablet Drawer A11y, and Worktree Live Release
- **Context & Bug Pattern**:
  - The Teacher Portal sidebar (`AdminNav.tsx`) is designed with a standard width of `264px` (`w-[264px]`), featuring tactile buttons, truncation guards, and action badges.
  - However, in `app/portal/page.tsx`, the parent grid container was hardcoded to `232px` via `lg:grid-cols-[232px_minmax(0,1fr)]`, and the slide-over drawer was set to `w-[232px]`.
  - Due to `overflow-y-auto` on the sidebar column, the right 32px of the sidebar was clipped off, hiding the separating right border (`border-r-2 border-[#201e1d]`), squishing buttons (`Switch to App Admin`, `Student Home`, `Overview`), and clipping badges (`NEW` on Test Compiler, `8` on Flagged Questions).
  - Additionally, the slide-over drawer close button in `AdminNav.tsx` had `md:hidden` instead of `lg:hidden`, rendering it hidden on tablet viewports where the drawer is active.
  - In `app/admin/page.tsx`, the layout was similarly slightly misaligned at `250px` instead of `264px`.

### 1. Architectural Insights & Fixes
- **Design System Grid Parity**:
  - Aligned desktop CSS Grid definitions in both `app/portal/page.tsx` and `app/admin/page.tsx` to `lg:grid-cols-[264px_minmax(0,1fr)]`.
  - Added `w-[264px] shrink-0` to the desktop sidebar sticky container to prevent flex/grid shrink compression.
  - Updated mobile/tablet slide-over drawer containers to `w-[264px] max-w-[85vw]`.
  - Added `shrink-0` to `<aside className="...">` in `AdminNav.tsx` (`w-[264px] shrink-0`).
- **Responsive Drawer Usability**:
  - Changed drawer close button visibility in `AdminNav.tsx` from `md:hidden` to `lg:hidden` so tablet users can cleanly dismiss the slide-over menu.

### 2. Worktree & Atomic Release Verification
- Worktree branch `feat/fix-teacher-portal-sidebar` was isolated, verified with `npx tsc --noEmit` (0 errors) and `npm test` (56/56 passing).
- Changes committed (`03c6234`), rebased, and released atomically to `origin/main`.
- Production build succeeded on Vercel (`fix-teacher-portal-sidebar.vercel.app`).
- Worktree cleanly torn down and feature branch removed.


## Reflection Log Entry - 2026-10-13 (Test Compiler Filter & Toolbar Spatial Optimization)

- **Date**: 2026-10-13
- **Topic**: Test Compiler Filter & Toolbar Spatial Optimization (Move to Right Column & Compact Redesign)
- **Context & Problem**:
  - The Test Compiler previously rendered a bulky 4-row Question Filter and Search toolbar above the question bank in the left column.
  - This consumed critical vertical space, forcing excessive scrolling and reducing question scanning efficiency.

### 1. Architectural Solutions & Spatial Restructuring
- **Left Column Canvas Expansion**:
  - Replaced the bulky filter toolbar with a sleek, compact sticky header bar (`Question Bank`, `{filteredQuestions.length} of {CAMBRIDGE_QUESTIONS.length} questions`, active filters badge, `Select All Filtered`).
  - Maximized vertical reading space for questions (`h-[calc(100vh-140px)] min-h-[520px]`).
- **Right Column Dual-Panel Architecture**:
  - Configured a persistent sticky container (`lg:sticky lg:top-4 h-[calc(100vh-130px)]`) housing two integrated panels:
    - **Panel 1: Compact Question Filters & Tools (`shrink-0`)**: Features collapsible toggle (`isFiltersExpanded`), compact search with quick-clear 'X', 2-column dropdowns grid (Topic, Series, Sort), 3-tab segmented status pill (`[All|Selected|Unselected]`), content chips (`Diagrams`, `Tables`, `Math`), and utility buttons (`Auto Preset`, `Drafts`, `Clear Selection`).
    - **Panel 2: Test Assembly Drawer (`flex-1 min-h-0`)**: Features summary header, layout & settings accordion, scrollable selected questions queue, and pinned action footer (`Save Draft`, `PDF / Print`).

### 2. Worktree & Atomic Release Verification
- All changes crafted in dedicated git worktree `feat/test-compiler-filter-redesign`, rebased on `origin/main`.
- Verified with 0 TypeScript errors (`npx tsc --noEmit`) and 56/56 passing automated tests.
- Atomically released live to remote `main` and Vercel production.

## Reflection Log Entry - 2026-10-13 (Ingestion Studio Payload Unpacking Collision, Error Surfacing, & File Input Staling)

- **Date**: 2026-10-13
- **Topic**: JSON Payload Envelope Collision, Silent Error Swallowing Elimination, and React File Input Resetting
- **Context & Incident**:
  - Ingestion Studio's JSON upload workflow failed when parsing candidate staging paper files. Uploading valid staging payloads either silently failed or crashed during candidate evaluation without informative user feedback.
  - Deep-dive investigation across the ingestion pipeline identified three compounding bugs across data normalization, error state management, and file input event triggers.

### 1. Root Cause & Architectural Anti-Patterns
- **Object Subfield Collision in Candidate Payload Unpacking**:
  - *Anti-Pattern*: `const candidatePaper = parsed.paper || parsed;`
  - In schemas where an entity has a metadata child property sharing the entity's noun (e.g. `StagingPaper` containing a metadata child property `paper: StagingPaperMeta` alongside `questions: StagingQuestion[]`), naive truthiness checking collapses the root document into its metadata child.
  - Because `parsed.paper` (`{ series: 's', paper_code: '12', year: 2024 }`) is truthy, the normalizer mistakenly selected the metadata child instead of the root document or wrapper envelope, discarding the `questions` array entirely and failing schema validation with 0 questions.
  - *Remediation*: Normalizers must explicitly verify `Array.isArray(parsed.paper?.questions)` before assuming a wrapper envelope:
    ```ts
    // Explicitly check for questions array inside envelope before unwrapping
    const candidatePaper = (parsed.paper && Array.isArray(parsed.paper.questions))
      ? parsed.paper
      : (Array.isArray(parsed.questions) ? parsed : parsed);
    ```
- **Silent UI Swallowing in Async Uploads & File Readers**:
  - *Anti-Pattern*: Catching or discarding validation failures inside asynchronous file readers (`FileReader.onload`, `loadJson`) without updating reactive store states or surfacing accessible feedback.
  - *Remediation*: File readers and async upload handlers must never discard validation failures without updating store status (`publishStatus: 'error'`, `publishMessage`) and providing accessible user alert banners (`role="alert"`).
- **File Input Staling in React**:
  - *Anti-Pattern*: Re-selecting the same file after fixing or re-generating it failed to trigger `onChange` because the `<input type="file">` DOM value remained identical.
  - *Remediation*: File inputs in React must always reset `e.target.value = ""` on change immediately after capturing the selected file reference so re-selecting the same file fires `onChange`.

### 2. Verification & Live Release
- Verified with 63 automated tests passing in Suite 11 (`scripts/verify-revizz.ts`).
- Clean production deployment to Vercel (`8a34a25`).

## Reflection Log Entry - 2026-10-13 (Dynamic Database Subject Selection Dropdown)

- **Date**: 2026-10-13
- **Topic**: Dynamic Database Subject Selection Dropdown & Database-Driven Start Page UI
- **Context & Problem**:
  - The student start page previously rendered a hardcoded 2x2 grid of buttons with 4 subjects: Physics (0625), Economics (0455), Chemistry (0620), and Biology (0610).
  - Chemistry (0620) and Biology (0610) did not exist in the database, presenting students with phantom syllabus paths.
  - The user requested replacing the grid with a dropdown that only reflects subjects stored in the Supabase database.

### 1. Architectural Insights & Implementation
- **Dedicated Database Subject Service (`lib/subjects.ts`)**:
  - Implemented `fetchSubjectsFromDb()` querying `supabase.from('subjects').select('id, code, name, icon').order('name')`.
  - Added safe fallback (`FALLBACK_SUBJECTS`) strictly restricted to verified database subjects (`Economics 0455` and `Physics 0625`), eliminating phantom entries during offline or transient network latency.
  - Added `getSubjectEmoji()` helper mapping icons/codes to tactile emojis with a sensible fallback (`📚`).
- **Tactile Neobrutalist Dropdown Component (`components/StartFlow.tsx`)**:
  - Replaced 2x2 buttons with an authentic 3D Neobrutalist popover dropdown (`border-2 border-text bg-neutral-100 rounded-[20px] shadow-offset-3`).
  - Integrated animated rotating chevron (`ChevronDown`), active selection checkmarks (`Check`), and tactile audio feedback (`playPop()`).
  - Full keyboard accessibility: dismisses on `Escape` key, outside-click detection via `mousedown` listener on container ref, and ARIA listbox attributes (`role="listbox"`, `aria-haspopup="listbox"`, `role="option"`, `aria-selected`).
  - Retained previous selection persistence via `localStorage` (`revizz_last_config`) with validation against available database subjects.

### 2. Worktree & Live Release Protocol
- Isolated in git worktree `feat/subject-dropdown-db`, rebased on latest `origin/main`.
- Self-verified with 0 TypeScript errors (`npx tsc --noEmit`) and 63/63 passing QA test suite.
- Atomic push directly from worktree branch to remote main (`git push origin feat/subject-dropdown-db:main`).
- Verified Vercel production deployment (`https://revizz-sand.vercel.app`) with HTTP 200.
- Worktree cleanly pruned and torn down.

## Reflection Log Entry - 2026-10-13 (HTML5 Drag & Drop Child Node Interception, Multimodal Cross-Dropzone Routing, & Defensive FileReader Lifecycle)

- **Date**: 2026-10-13
- **Topic**: HTML5 Drag & Drop Child Node Interception, Multimodal Cross-Dropzone Routing, & Defensive FileReader Lifecycle
- **Context & Incident**:
  - Ingestion Studio's PDF and JSON drag-and-drop workflows exhibited intermittent drop cancellation and failure when users dropped files directly onto child elements within drop targets (headings, text prompts, icons, badges) in modern web browsers (macOS WebKit and Chromium).
  - Users frequently dropped `.json` staging paper files onto the active Question Paper / Mark Scheme PDF dropzones rather than switching tabs first, causing files to be silently ignored.
  - Asynchronous `FileReader` operations lacked lifecycle safeguards against unexpected aborts or read errors, risking perpetual loading/spinner UI states.

### 1. Root Cause & Architectural Anti-Patterns
- **HTML5 Drag & Drop Child Node Interception in WebKit & Chromium**:
  - *Anti-Pattern*: Dropping files onto a dropzone whose child elements (headings, text, buttons, icons) do not call `e.preventDefault()` on `dragover` causes the browser to either cancel the drop event or attempt default navigation/download.
  - *Remediation*: Child elements inside any file dropzone must be styled with `pointer-events-none` (except explicitly interactive buttons like "Remove", which need `pointer-events-auto` and `stopPropagation`). Drop containers must explicitly define `onDragEnter`, `onDragOver` with `e.dataTransfer.dropEffect = "copy"`, and `onDrop`.
- **Multimodal Cross-Dropzone Routing & Silent Discard Elimination**:
  - *Anti-Pattern*: In multimodal ingestion interfaces with multiple workflow tabs (e.g. AI Cloud PDF pipeline vs. Offline Agent JSON workflow), users naturally drop files into whatever drop target is currently on screen. Drop targets should never silently discard non-matching file types.
  - *Remediation*: Drop targets must inspect file extensions and MIME types, cross-routing `.json` papers to `onUploadJson` and `.pdf` files to Question Paper / Mark Scheme targets, supplemented with an outer container drop fallback so files dropped anywhere within the wizard frame are captured and processed.
- **Defensive FileReader Lifecycle State Management**:
  - *Anti-Pattern*: Initiating asynchronous `FileReader` workflows without guarding state transitions against aborts or errors, leaving UI in an infinite loading/spinner state.
  - *Remediation*: Asynchronous `FileReader` flows must guard state with `try / finally { setIsReading(false) }` and handle `reader.onerror` and `reader.onabort` to prevent stuck spinner/loading states and ensure clear user error feedback.

### 2. Verification & Live Release
- 67/67 automated test assertions passing in `scripts/verify-revizz.ts` (Suite 12 covering dropzone event propagation, cross-routing, and end-to-end 30-question staging paper parsing).
- Strict TypeScript verification passing with 0 errors (`npx tsc --noEmit`).
- Clean atomic push and live deployment on Vercel (`9bbf908`).

## Reflection Log Entry - 2026-10-13 (Gemini API Model Evolution, Distributed 503 Capacity Resilience, Vercel 4.5MB Serverless Bypass, & Dedicated Antigravity Agent Offline Ingestion Pipeline)

- **Date**: 2026-10-13
- **Topic**: Gemini API Model Evolution (gemini-3.8-flash), Distributed 503 Capacity Resilience, Vercel 4.5MB Serverless Bypass, & Dedicated Antigravity Agent Offline Ingestion Pipeline
- **Context & Problems Solved**:
  1. **Google Gemini Model Deprecation & Hard HTTP 404 Failures**:
     - Google officially retired `gemini-2.0-flash` and restricted legacy `gemini-2.5-flash` endpoints with HTTP 404 for new extraction requests.
     - Enforced strict model remapping and normalization defaulting to `gemini-3.8-flash` across all extractors and routes (`lib/ingestion/geminiExtractor.ts`, `app/api/ingest/extract/route.ts`, and `lib/ingestion/useIngestionStore.ts`).
  2. **High-Demand Gemini Capacity Spikes (HTTP 503 & 429)**:
     - Implemented enterprise-grade adaptive exponential backoff with random jitter (`delay = min(30, (2 ** attempt) * 1.5 + Math.random() * 2)`) across up to 5 automatic retries.
     - Emitted real-time SSE countdown statuses (`retrying` stage) with seconds-to-retry indicators so curators are informed directly on-screen.
     - Preserved partial extraction batches: if an unrecoverable failure occurs mid-paper after 5 retries, extracted questions are retained so curators never lose in-flight work.
  3. **Vercel Serverless Payload Limits & Direct Client CORS Fallback**:
     - Vercel serverless has a strict 4.5 MB request body limit and 15s default execution timeout, causing scanned Cambridge past paper PDFs (often 5-15 MB) to fail silently or abort at the edge proxy.
     - Configured route runtime with `maxDuration = 60` and implemented periodic SSE heartbeat comments (`: keepalive\n\n`) every 3 seconds to prevent edge/proxy disconnects.
     - Reduced default batch size from 10 to 5 questions to keep chunk latency well under serverless timeouts.
     - Added direct client-side Google Gemini API extraction fallback when a client API key is provided, completely bypassing the Vercel serverless proxy and supporting PDFs up to 20 MB.
  4. **Dual-Workflow Setup Wizard & Dedicated Antigravity Agent Pipeline**:
     - Implemented prominent Neobrutalist workflow toggle between "AI Cloud Pipeline" (browser-first) and "Antigravity Agent Workflow" (offline/local processing).
     - Enhanced `app/api/ingest/staged-paper/route.ts` to return rich metadata (`stagedPapers`) for auto-detecting staged files in `staging/`.
     - Added 1-click loading from detected paper cards into the Dual-Pane Curation Studio.
     - Added dedicated Agent JSON dropzone and copyable CLI/chat prompt cheatsheets.
  5. **Interactive Presentation & Ingestion User Manual**:
     - Authored standalone interactive presentation deck (`ingestion_studio_presentation.html`) and structured slide deck artifact (`ingestion_studio_presentation.md`) documenting end-to-end ingestion workflows.

### 1. Root Causes, Architectural Insights & Technical Solutions

#### A. Gemini Model Evolution & Normalization (`normalizeGeminiModel`)
- **The Issue**: Deprecated model identifiers (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-1.5-pro`) trigger sudden HTTP 404 `NOT_FOUND` errors from Google's Generative Language API.
- **Architectural Solution**:
  - Implemented centralized normalization in `lib/ingestion/geminiExtractor.ts`:
    ```ts
    export function normalizeGeminiModel(model?: string): string {
      if (!model) return 'gemini-3.8-flash';
      let trimmed = model.trim();
      if (trimmed.startsWith('models/')) trimmed = trimmed.replace(/^models\//, '');
      if (!trimmed || trimmed.includes('gemini-2.5') || trimmed.includes('gemini-2.0') || trimmed.includes('gemini-1.5')) {
        return 'gemini-3.8-flash';
      }
      return trimmed;
    }
    ```
  - Standardized this normalization across client stores, serverless API routes, and verify test assertions.

#### B. Distributed 503 Capacity Resilience & Exponential Jitter Backoff
- **The Issue**: Surges in Gemini API traffic trigger transient HTTP 503 (Service Unavailable) or 429 (Too Many Requests), which previously failed the entire extraction job.
- **Architectural Solution**:
  - Transient error detection (`isTransientCapacityError`): recognizes HTTP 503, 502, 504, 429, and phrases like "high demand", "overloaded", or "capacity".
  - Exponential Backoff with Jitter: Bounded between 1.5s and 30s (`Math.min(30, Math.pow(2, attempt) * 1.5 + Math.random() * 2)`), preventing thundering herds.
  - Transparent SSE Feedback: Curators see real-time countdown banners (`"Google API high demand (503). Auto-retrying Q1-Q5 in 4s (attempt 2/5)..."`).
  - Partial Batch Preservation: If all 5 retries fail on batch $N$, earlier batches are preserved and loaded into the curation studio with a `partial_complete` state and a "Resume Extraction" option.

#### C. Vercel 4.5MB Serverless Bypass & Direct Client CORS Fallback
- **The Issue**: Vercel Serverless Functions enforce a rigid 4.5 MB payload limit (`FUNCTION_PAYLOAD_TOO_LARGE`) and 15s default execution limit. High-resolution scanned Cambridge PDFs (often 6–15 MB) fail instantly when uploaded to `/api/ingest/extract`.
- **Architectural Solution**:
  - Route Configuration: Configured `export const maxDuration = 60;` in `app/api/ingest/extract/route.ts` with 3-second SSE keepalive comments (`: keepalive\n\n`) to prevent browser and CDN proxy disconnects.
  - Chunk Optimization: Decreased batch size from 10 to 5 questions, halving per-request processing latency.
  - Client-Side Fallback: In `lib/ingestion/useIngestionStore.ts`, if the combined PDF size exceeds 4.5 MB and a client API key is supplied, extraction bypasses the server route entirely and calls Google Gemini API directly via CORS in the browser, accommodating files up to 20 MB.

#### D. Dual-Workflow Setup Wizard & Antigravity Agent Offline Ingestion
- **The Issue**: Browser-based uploads are ideal for quick single papers, but bulk exam archives or large batches require offline CLI processing by autonomous coding agents without token or proxy constraints.
- **Architectural Solution**:
  - Dual-Workflow Tabbed Interface: Added high-contrast Neobrutalist toggle in `IngestionSetupWizard.tsx` between "AI Cloud Pipeline" and "Antigravity Agent Workflow".
  - Auto-Detection Route (`/api/ingest/staged-paper`): Scans `staging/*.json`, parses root metadata (`subject`, `paper`, `questionsCount`, `lifecycle_state`), and presents clickable cards for 1-click loading directly into the curation studio.
  - Dedicated Agent JSON Dropzone & Copyable Prompts: Enables drag-and-drop of agent-generated staging JSON files with cheatsheet prompts for running offline agent ingestion.

#### E. Interactive Visual Documentation & User Manual
- **Deliverables**:
  - `ingestion_studio_presentation.html`: Interactive, standalone presentation deck with Neobrutalist design, dark mode compatibility, and animated walkthroughs of both Cloud and Agent ingestion pipelines.
  - `ingestion_studio_presentation.md`: Markdown companion artifact for developer onboarding and design alignment.

### 2. Verification & Automated Test Suites
- Verified against Revizz Comprehensive QA & Verification Test Suite (`scripts/verify-revizz.ts`):
  - **Suite 8 (Gemini Ingestion Model Migration & Normalization)**: 10/10 tests verifying model remapping, base64 data conversion, serverless route configurations, transient error classification, exponential backoff bounds, and Gemini 3.8 preservation.
  - **Suite 10 (Antigravity Dedicated Agent Workflow & Staged Paper Route)**: Tests verifying the `/api/ingest/staged-paper` contract, staged papers metadata, setup wizard dual-mode UI, and offline skill documentation.
- **TypeScript Strict Check**: `npx tsc --noEmit` passed with 0 errors across the entire codebase.

## Reflection Log Entry - 2026-10-13 (Ingestion Pipeline Feedback & User Orientation, Eliminating Mock Publishing, & Question Status Schema Alignment)

- **Date**: 2026-10-13
- **Topic**: Ingestion Pipeline Feedback & User Orientation, Eliminating Mock Publishing, Question Status Schema Alignment, & Live Supabase Upsert Receipts
- **Context & Objectives**:
  - Ingestion Studio's JSON past paper ingestion workflow previously dumped curators straight into a granular question-by-question editing view without confirmation of parse success or persistence status.
  - Curators were left uncertain whether Cambridge past papers (e.g. 30 questions) were persisted in the database or only residing in transient client memory, leading to accidental data loss or duplicate ingestion.
  - Staging review interfaces (`StagingReview.tsx`) relied on mock `setTimeout` publishing logic in production code rather than real relational database synchronization.
  - Schema inconsistencies in question status mapping (mapping review-stage questions to `'draft'` instead of `'active' | 'withdrawn'`) caused schema validation and database insertion rejections.

### 1. Root Causes, Architectural Insights & Technical Solutions

#### A. Ingestion Pipeline Feedback & User Orientation (`IngestionPipelineModal.tsx`)
- **The Issue**: When ingesting large structured documents (like 30-question Cambridge MCQ exam papers), abruptly dropping curators into a granular question-by-question editor leaves users disoriented and uncertain whether parsing succeeded, which schema version was detected, or if modifications were persisted to the database.
- **Architectural Solution**:
  - Implemented an intermediate, high-visibility Ingestion Pipeline Modal / Status Card (`components/portal/IngestionPipelineModal.tsx`) providing:
    - **File & Schema Metrics**: Displaying parsed file name, file size, paper identifier (`0455_s24_12`), question count (e.g., 30 questions), and schema validation health checks.
    - **Persistence Status Awareness**: Prominently clarifying that loaded papers reside in client-side memory until explicitly committed to the relational database.
    - **Primary 1-Click Action**: A high-contrast Neobrutalist `"Upsert to Database"` button that triggers direct relational persistence via canonical `/api/ingest/publish` APIs.
    - **Live Receipts**: On successful upsert, renders database confirmation receipts (paper ID, questions created/updated count, timestamp, and target subject).
    - **Seamless Routing**: Quick navigation buttons to `"View in Question Bank"` (`/admin?tab=bank`) or `"Continue Curating in Studio"`.

#### B. Eliminating Mock Publishing in Production Staging Interfaces
- **The Issue**: Production staging review interfaces previously simulated database publishing using artificial `setTimeout` timers with placeholder feedback, giving curators a false sense of database persistence while leaving the live Supabase tables unpopulated.
- **Architectural Solution**:
  - Completely excised mock `setTimeout` simulation in `components/portal/StagingReview.tsx` and `lib/ingestion/useIngestionStore.ts`.
  - Wired all publishing and approval actions directly to canonical relational ingestion APIs (`/api/ingest/publish`).
  - Added real-time error handling with defensive `FileReader.onerror` callbacks, clear error states, and suppression of optimistic success banners when network or database failures occur.
  - Stored live `PublishReceipt` records (`publishedAt`, `paperId`, `questionsUpserted`, `status`) in state to display verifiable database confirmations.

#### C. Question Status Schema Alignment (`'active' | 'withdrawn'`)
- **The Issue**: Mapping unapproved or review-stage questions to a `'draft'` status in question entity objects broke Cambridge MCQ schema validation (`validateStagingPaper`) and Supabase check constraints.
- **Root Cause**: The Cambridge MCQ question entity schema strictly supports `'active' | 'withdrawn'`. While papers themselves possess lifecycle states (`draft`, `in_review`, `approved`, `published`), individual questions within a paper must adhere strictly to `'active' | 'withdrawn'`.
- **Architectural Solution**:
  - Standardized question status mappings across staging reviews and stores:
    ```ts
    status: (q.status === 'withdrawn' ? 'withdrawn' : 'active') as 'active' | 'withdrawn'
    ```
  - Eliminated `'draft'` question status references across all ingestion and staging pipelines, ensuring 100% compliance with database schema definitions and validators.

### 2. Verification & Automated Test Suites
- Comprehensive QA suite passing 74/74 assertions across 13 suites in `scripts/verify-revizz.ts`:
  - **Suite 13 (Ingestion Pipeline Overhaul, Status Feedback & Supabase Upsert Receipts)**: 7 automated tests verifying `useIngestionStore` pipeline modal tracking, `publishToSupabase` live database receipts and error handling, `IngestionPipelineModal` audit components, `IngestionHub` lifecycle integration, `StagingReview` real API wiring, question status `'active' | 'withdrawn'` adherence, and prominent JSON upload affordances across Cloud and Agent tabs.
  - Strict TypeScript check passing with 0 errors (`npx tsc --noEmit`).

## Reflection Log Entry - 2026-10-14 (Standing Specialist Fleet Architecture, Asynchronous Pipelining & Bulk Past Paper Ingestion)

- **Date**: 2026-10-14
- **Topic**: Multi-Agent Velocity via Standing Specialist Fleet, Asynchronous Pipelining, Hot Compiler Daemons, & Bulk Cambridge Past Paper Ingestion Archive
- **Context & Objectives**:
  - Eliminating the cold-start turn overhead in multi-agent workflows where freshly spawned subagents burned 15k–35k tokens re-discovering the codebase before writing code.
  - Scaling up past paper availability across Cambridge IGCSE Economics (0455) for all variants across 2022–2024 series (May/June, Feb/March, Oct/Nov) using autonomous slice aggregation and high-throughput extraction scripts.

### 1. Multi-Agent Velocity & Orchestrator Economics
- **The Standing Specialist Fleet Architecture**:
  - Instead of spawning and terminating disposable subagents per task, maintain warm, long-lived domain specialists (Frontend Specialist, Backend Ingestion Specialist, QA Verifier).
  - Communicating via `send_message(Recipient=conversationId, Message=...)` feeds subsequent tasks directly into the agent's active memory.
  - Zero-turn cold discovery: Because the agent already retains component hierarchies, state stores, and dependency graphs in its active context, task execution begins immediately on turn 1, saving 30–90 seconds and up to 75% of discovery tokens per invocation.
- **Asynchronous Pipelining**:
  - Transitioned from serial waterfall execution to overlapped stages: while the implementation specialist writes feature code in the worktree, the QA specialist concurrently drafts test assertions and mock fixtures.
  - Hand-off latency is reduced to near zero: as soon as code is committed, the warm QA specialist executes the pre-staged test harness immediately.
- **Hot Incremental Compiler Watchers**:
  - Replaced cold `npx tsc --noEmit` boots (8–14 seconds) with a persistent worktree background watcher (`npx tsc --noEmit --watch --preserveWatchOutput`).
  - Leveraging TypeScript's incremental symbol cache (`.tsbuildinfo`) provides sub-300ms type-checking verification loops during active development.

### 2. Large-Scale Cambridge Past Paper Ingestion Archive
- **Archive Extraction & Normalization**:
  - Ingested 19+ complete Cambridge IGCSE Economics (0455) past papers covering 2022–2024 series (e.g. `0455_m23_12`, `0455_m24_12`, `0455_s22_11..13`, `0455_s23_11..13`, `0455_s24_11..13`, `0455_w22_11..13`, `0455_w23_11..13`, `0455_w24_11..13`).
  - Normalized hundreds of diagram figures extracted into `public/questions/0455_<year>_<series>_<paper>_q<num>.png`.
  - Staging papers saved under `staging/` conforming strictly to the TypeScript `StagingPaper` schema with verified 4-option parity, syllabus mapping, and KaTeX currency escaping (`\$50`).

### 3. Verification & Test Suite Status
- Programmatic QA suite passing all 74/74 assertions across 13 comprehensive suites in `scripts/verify-revizz.ts`.
- Full TypeScript validation (`npx tsc --noEmit`) verified clean with 0 errors.


## Reflection Log Entry - 2026-10-14 (Purging Mock Cambridge Data, Empty Database UI Defense, & Atomic Live Release)

- **Date**: 2026-10-14
- **Topic**: Purging Mock Cambridge Data, Empty Database UI Defense, & Atomic Live Release
- **Target Surfaces**:
  - Data Layers: `lib/subjects.ts`, `lib/questions.ts`, `lib/testCompiler.ts`, `lib/supabaseClient.ts`
  - Client UI & Portal: `app/page.tsx`, `components/StartFlow.tsx`, `components/TopicMasteryList.tsx`, `components/portal/TeacherAnalytics.tsx`, `components/portal/AdminTools.tsx`, `components/portal/AdminCMS.tsx`, `components/portal/compiler/TestCompilerHub.tsx`, `components/admin/AppAdminHub.tsx`, `app/portal/page.tsx`, `components/portal/StagingReview.tsx`
  - Automated QA Suites: `scripts/verify-empty-db-state.ts`, `scripts/verify-revizz.ts`

### 1. Context & User Directive
- **The Issue**: When launching with an empty production Supabase database, multiple application surfaces leaked artificial fallback data, giving users and educators the false impression that content was present when none had been published.
- **Leaked Mock Artifacts**:
  - Hardcoded subjects and questions (`FALLBACK_SUBJECTS` with Economics 0455 & Physics 0625; fallback questions like `"Why will scarcity always exist?"`).
  - Fake cohorts (`"10A Physics"`, `"10B Physics"`, `"11A Chemistry"`, `"11C Economics"` with teachers `"Mr. D. Patel"`, `"Ms. A. Okafor"`, `"Mr. C. Tan"`).
  - Hardcoded school and institutional licences (`"Frontier International Academy"`, `"Revizz Enterprise Campus"` with fixed seat metrics 250/300).
  - Static filter pills (`"Economics 0455 ✕"`) pinned in Question Bank filters even when no subjects or papers existed.
- **User Directive**: Completely purge all hardcoded mock data, enforce zero-fallback data layer contracts returning `[]` when tables are empty or offline, and build tactile Neobrutalist empty states ("empty signs") across every production surface.

### 2. Architectural Solutions

#### A. Zero-Fallback Data Layer Contracts
- **`lib/subjects.ts`**:
  - Emptied `FALLBACK_SUBJECTS = []`.
  - Refactored `fetchSubjectsFromDb()` to strictly return `[]` upon empty database tables or query failures instead of injecting synthetic fallback subject records.
- **`lib/questions.ts`**:
  - Implemented live relational fetch functions: `fetchQuestionsFromDb()` and `fetchTopicsFromDb(subjectId?)`.
  - Enforced strict `[]` return on empty tables or Supabase network/query errors.
  - Provided reactive hooks `useQuestions()` and `useTopics()` returning `{ questions, loading, error }` and `{ topics, loading, error }` backed by live Supabase queries.
- **`lib/supabaseClient.ts`**:
  - Polyfilled Node runtime `WebSocket` (`MockWebSocket`) to ensure headless CLI test execution in Node environments without crashing Supabase Realtime listeners.

#### B. Dynamic Question Compiler (`lib/testCompiler.ts`)
- Decoupled `buildCompiledQuestions()`, `autoSelectQuestions()`, and `generateTestPaper()` from static `CAMBRIDGE_QUESTIONS`.
- Made question pool dynamic (`questionPool: Question[] = []`), cleanly producing empty test paper bundles (`questions: []`, `totalQuestions: 0`, `totalMarks: 0`) when the pool has zero active questions.

#### C. Neobrutalist Empty State System Across All UI Surfaces
- **Student Home (`app/page.tsx`)**:
  - Replaced hardcoded fallback question slicing with live `fetchQuestionsFromDb` and `fetchTopicsFromDb`.
  - Renders a full-screen Neobrutalist empty state (`"📭 No Questions Available"`) linking students directly to the Educator Portal when the question bank is empty.
- **Setup & Topic Mastery (`components/StartFlow.tsx`, `components/TopicMasteryList.tsx`)**:
  - Dynamic subject fallback handling when `subjects.length === 0`.
  - Tactile empty card (`"📚 No Topics Available"`) rendered when topics or questions are zero, explaining that syllabus mastery will populate upon exam paper publication.
- **Question Compiler Hub (`components/portal/compiler/TestCompilerHub.tsx`)**:
  - Replaced hardcoded sample question slices with dynamic `useQuestions()` and `useTopics()`.
  - Added high-visibility Neobrutalist empty state (`"📭 Question Bank Empty"`) when no questions exist.
  - Made school name input placeholder dynamic (`"Enter school or institution name..."`).
- **Admin Tools & Question Bank (`components/portal/AdminTools.tsx`)**:
  - Stripped the hardcoded `"Economics 0455 ✕"` filter pill.
  - Replaced hardcoded subject state with dynamic database lookup via `fetchSubjectsFromDb()`, falling back to `'No subjects registered'`.
  - Replaced static assigned questions (`assignQs`) with dynamic slices from `useQuestions()`, rendering an empty state when no questions are assigned.
- **Question Editor CMS (`components/portal/AdminCMS.tsx`)**:
  - Replaced hardcoded default question (`"Why will scarcity always exist?"`) with clean, dynamic selection from live question records.
  - Renders graceful empty state when question bank contains zero records.
- **Staging Review (`components/portal/StagingReview.tsx`)**:
  - Renders an empty staging state when no staged papers or questions are in the queue, preventing phantom approval buttons.
- **Teacher Analytics & Roster (`components/portal/TeacherAnalytics.tsx`)**:
  - Purged hardcoded class pill array (`['10A Physics', '10B Physics', '11A Chemistry', '11C Economics']`).
  - Renders dynamic class pills from active student profiles and displays empty states (`"No active classes"`, `"No student activity recorded"`) when roster tables have 0 rows.
- **School Licence & Leaderboard (`app/portal/page.tsx`)**:
  - Purged hardcoded `"Frontier International Academy"` and `"Revizz Enterprise Campus"` strings.
  - Displays dynamic institution names derived from authenticated educator profiles or neutral fallback (`"Institutional Campus"`).
  - Renders empty cohorts card (`"No cohorts registered"`) when institutional databases are unseeded.
- **App Admin Hub (`components/admin/AppAdminHub.tsx`)**:
  - Replaced hardcoded cohort list with dynamic cohort rendering and empty state fallback.

### 3. Verification Suite
- **Dedicated 97-Check Automated Audit (`scripts/verify-empty-db-state.ts`)**:
  - **Suite 1 (Database Functions Empty/Fallback Verification - 7/7 PASS)**: Verifies `FALLBACK_SUBJECTS` is empty `[]`, and `fetchSubjectsFromDb()`, `fetchQuestionsFromDb()`, `fetchTopicsFromDb()` return `[]` on empty tables and query errors without synthetic fallbacks.
  - **Suite 2 (Static Code Hardcoded Mock Data Audit - 81/81 PASS)**: Audits 9 key production files, verifying 0 occurrences of:
    - `"Frontier International Academy"`
    - `"Revizz Enterprise Campus"`
    - `"Why will scarcity always exist?"`
    - `"Mr. D. Patel"`
    - `"10A Physics"`
    - `"10B Physics"`
    - `"Ms. A. Okafor"`
    - `"Mr. C. Tan"`
    - `"Economics 0455 ✕"` (and regex variations)
  - **Suite 3 (Empty State UI Implementation Audit - 9/9 PASS)**: Programmatically verifies explicit empty state branches and copy across all 9 UI surfaces.
- **Core Regression Suite (`scripts/verify-revizz.ts`)**:
  - 74 / 74 tests passing across all 13 suites.
- **Strict TypeScript Validation**:
  - `npx tsc --noEmit` passing with 0 errors.

### 4. Operational Protocols
- **Worktree Isolation (`.worktrees/*`)**:
  - Features developed and verified inside dedicated git worktrees (`.worktrees/strip-mock-data-*` and `.worktrees/remove-qb-pill-*`) branched directly from `origin/main`.
  - Local `main` kept strictly clean and unpolluted during development and test runs.
- **Atomic Live Release**:
  - Rebased onto latest `origin/main`.
  - Pushed exclusively via refspec `git push origin <branch>:main` upon explicit user permission, ensuring only verified commits were deployed to production on Vercel without risk of local branch drift.
- **Teardown & Cleanup**:
  - Worktrees cleanly removed via `git worktree remove --force` upon deployment sign-off.


## Reflection Log Entry - 2026-10-14 (Cambridge 0455 Staging Verification, KaTeX Currency Delimiters, & Ingestion Studio Auto-Discovery)

- **Date**: 2026-10-14
- **Topic**: Cambridge Economics 0455 Staging Verification, KaTeX Currency Delimiters, & Ingestion Studio Auto-Discovery
- **Target Surfaces**:
  - Validation & Ingestion Core: `types/ingestion.ts`, `lib/ingestion/katexSanitizer.ts`, `lib/ingestion/useIngestionStore.ts`
  - Ingestion API Endpoints: `app/api/ingest/staged-paper/route.ts`, `app/api/ingest/publish/route.ts`
  - Ingestion Studio UI: `components/portal/IngestionSetupWizard.tsx`, `components/portal/StagingReview.tsx`, `components/portal/IngestionStemEditor.tsx`, `components/portal/IngestionDiagnostics.tsx`

### 1. Cambridge 0455 Paper 1 Staging Verification (30 vs 40 Question Specifications)
- **Syllabus Discrepancy**:
  - Standard Cambridge IGCSE Science papers (Physics 0625, Chemistry 0620, Biology 0610 Paper 1 & Paper 2) comprise exactly 40 multiple-choice questions (45 minutes, 40 marks).
  - Cambridge IGCSE Economics (0455 Paper 1) comprises exactly **30 multiple-choice questions** (45 minutes, 30 marks).
- **Flexible Batch Validation Architecture**:
  - In `types/ingestion.ts`, `validateStagingPaper(data, options)` enforces schema conformity, 4 options per question (`A`, `B`, `C`, `D`), and at least one marked correct option.
  - The expected question count logic:
    ```typescript
    const expectedCount =
      options?.expectedQuestionCount ?? (options?.allowPartialBatch ? undefined : 40);
    ```
  - By passing `{ allowPartialBatch: true }` in both `GET /api/ingest/staged-paper` and `POST /api/ingest/publish`, the ingestion engine safely accommodates 30-question papers (like Economics 0455) without throwing spurious `"Paper must contain exactly 40 questions"` errors, while still enforcing that question arrays are non-empty (`paper.questions.length > 0`) and structurally valid.

### 2. KaTeX Currency Sanitization & Pre-computation
- **The Delimiter Collision Problem**:
  - Economics questions routinely feature currency values (e.g. `US$`, `\$50 to \$60`, `price drops from \$10 to \$8`).
  - Standard Markdown/KaTeX parsers interpret unescaped single `$` symbols as inline math delimiters. When two currency symbols occur on the same line (e.g. `\$5 to \$6`), KaTeX treats the intervening text as a mathematical formula, mangling text formatting and throwing syntax errors.
- **Architectural Defense (`lib/ingestion/katexSanitizer.ts`)**:
  - **`escapeCurrencyDollars()`**:
    - Pre-stashes display math blocks (`$$...$$`) into protected placeholders (`@@DISPLAY_MATH_N@@`).
    - Analyzes inline dollar signs line-by-line: escapes dangling single dollar signs (`\$`) and detects adjacent currency sequences where closing `$` is immediately followed by a digit (e.g. `\$50 to \$60`).
    - Normalizes isolated currencies like `US$` into `US\$`.
  - **`sanitizeKaTeX()` Pipeline**:
    - Integrated throughout the ingestion workflow: `IngestionStemEditor`, `IngestionOptionsEditor`, `IngestionDiagnostics`, `IngestionLivePreview`, and `IngestionPreviewModal`.
    - Automatically escapes currency notation while preserving genuine LaTeX expressions (superscripts, subscripts, fractions, formulas), preventing frontend math render crashes.

### 3. Ingestion Studio Setup Wizard Auto-Discovery
- **Seamless Local-to-Studio Workflow**:
  - Staged JSON papers generated by autonomous agents or conversion pipelines placed into the `staging/` directory (e.g. `staging/0455_s24_12.json`) are automatically discovered by `GET /api/ingest/staged-paper`.
  - The endpoint reads `staging/`, filters for `.json` files, extracts metadata (subject code, session, year, variant, question count), and validates their integrity via `validateStagingPaper(..., { allowPartialBatch: true })`.
- **1-Click Load Cards in Antigravity Agent Tab**:
  - In `components/portal/IngestionSetupWizard.tsx`, the Antigravity Agent tab queries `/api/ingest/staged-paper` on mount and after staging events.
  - Discovered files are rendered as interactive, tactile 1-click load cards displaying paper code, session, year, and question count badge (e.g. `30 Qs` for 0455, `40 Qs` for 0625).
  - Clicking a card immediately loads the validated staging paper directly into `useIngestionStore`, bypassing manual file-dialog browsing or copy-pasting.


## Reflection Log Entry - 2026-10-14 (Dynamic Flagged Questions Badge Count & Alert Zero-Suppression)

- **Date**: 2026-10-14
- **Topic**: Dynamic Flagged Questions Badge Count & Alert Zero-Suppression
- **Target Surfaces**:
  - Teacher Portal Navigation: `components/portal/AdminNav.tsx`
  - Admin Navigation Component: `components/admin/AppAdminNav.tsx`
  - Portal Page Layout & Props: `app/portal/page.tsx`
  - CMS Question Management: `components/portal/AdminCMS.tsx`

### 1. Problem / Incident
- **User Incident Report**:
  - The user reported: *"there are no errors but the badge says 8"*, providing a screenshot of the Teacher Portal navigation showing an orange circular pill badge containing the number `'8'` adjacent to the **"Flagged questions"** navigation item.
  - In `components/portal/AdminCMS.tsx`, Cambridge questions had 0 open user reports and 0 validation errors, yet the navigation badge alarmed the user with an apparent, persistent error count of `8`.
- **False Alarm & Cognitive Friction**:
  - Educators and administrators rely on alert badges to prioritize operational intervention. An inaccurate, persistent counter badge induces alarm fatigue and undermines confidence in data synchronization and system status.

### 2. Root Cause Analysis
- **Hardcoded Placeholder Markup**:
  - Both `components/portal/AdminNav.tsx` (lines 308–310) and `components/admin/AppAdminNav.tsx` (lines 245–247) retained static mock badge elements left over from initial UI prototyping:
    ```tsx
    <span className="w-5 h-5 rounded-full bg-[#ffc6a5] text-[#8c491a] text-[10px] font-black border border-[#201e1d]/25 flex items-center justify-center shrink-0">
      8
    </span>
    ```
  - The badge was neither wired to component props nor connected to reactive store state, rendering unconditionally with static `'8'` regardless of actual flagged question counts.

### 3. Architectural Resolution & Zero-Suppression Pattern
- **Dynamic Prop Interface Extension**:
  - Added optional `flaggedCount?: number` to `AdminNavProps` in `components/portal/AdminNav.tsx` and `AppAdminNavProps` in `components/admin/AppAdminNav.tsx`.
  - Defaulted `flaggedCount = 0` in component parameter destructuring.
- **Strict Conditional Zero-Suppression**:
  - Replaced the static markup with strict conditional rendering:
    ```tsx
    {flaggedCount > 0 && (
      <span className="w-5 h-5 rounded-full bg-[#ffc6a5] text-[#8c491a] text-[10px] font-black border border-[#201e1d]/25 flex items-center justify-center shrink-0">
        {flaggedCount}
      </span>
    )}
    ```
- **Zero-Suppression Design Pattern for Alerts**:
  - Alert and notification counter badges should never display when the count is `0` (or negative) unless explicitly designed as a balanced inventory status tab (e.g. `All (0)`).
  - For navigation alert and warning badges, suppressing the badge entirely on `0` preserves visual clarity, eliminates false-alarm cognitive load, and maintains user trust.
- **Layout Synchronicity Verification**:
  - Verified sidebar layout grid synchronicity with §15.3 (`264px` wide desktop column and drawer width in `app/portal/page.tsx`), ensuring badge emergence or suppression does not introduce layout shifts.

### 4. Verification & Validation Results
- **Automated Unit Testing**:
  - 10 automated unit test scenarios verifying omission on `undefined`, `0`, and `-1`, and accurate numeric rendering on `5` and `42` across both navigation components.
- **Strict TypeScript Validation**:
  - `npx tsc --noEmit` passing with 0 errors.
- **Atomic Live Release & Production Verification**:
  - Live atomic push (`git push origin feat/flagged-badge-count-10142103:main`) and verified live deployment at `https://revizz.vercel.app` (HTTP 200).


## Reflection Log Entry - 2026-10-14 (Serverless Read-Only Filesystem Resilience, Supabase Storage Hybrid Staging Synchronization, & Next.js App Router Route Export Type Constraints)

- **Date**: 2026-10-14
- **Topic**: Serverless Read-Only Filesystem Resilience (`/var/task`), Supabase Storage Hybrid Staging Synchronization, and Next.js App Router Route Export Type Constraints
- **Target Surfaces**:
  - Ingestion Storage Library: `lib/ingestion/stagedPaperStorage.ts`
  - Ingestion API Endpoint: `app/api/ingest/staged-paper/route.ts`
  - Verification & Regression Suite: `scripts/verify-staged-paper-sync.ts`

### 1. Incident 1: Serverless Read-Only Filesystem Exception (`ENOENT / EROFS`)
- **Problem**:
  - When archiving a staged past paper in production on Vercel via `POST /api/ingest/staged-paper` (`action: "archive"`), the endpoint threw an unhandled server error:
    ```
    Failed to archive paper: ENOENT: no such file or directory, mkdir '/var/task/staging/archive'
    ```
  - Attempts to unarchive or delete staged papers similarly failed under production runtime conditions.
- **Root Cause**:
  - On Vercel and AWS Lambda execution environments, the runtime working directory (`/var/task`) is strictly read-only.
  - Calling synchronous or asynchronous Node.js filesystem mutations such as `fs.mkdirSync`, `fs.renameSync`, or `fs.unlinkSync` targeting paths under `process.cwd()` fails immediately with `ENOENT` (directory does not exist and cannot be created) or `EROFS` (read-only file system).
  - Furthermore, serverless Lambda instances are ephemeral and stateless; local filesystem changes (even in `/tmp`) are not shared across concurrently running or future serverless invocations. Relying on local disk state for lifecycle flags (`archived`, `deleted`) causes cross-instance drift and data loss.
- **Architectural Solution: Hybrid Persistence Pattern**:
  - **Remote Cloud Authority (Supabase Storage)**:
    - Persist paper lifecycle states remotely in Supabase Storage under bucket `question-diagrams` at path `staged_metadata/paper_states.json`.
    - Data structure:
      ```typescript
      interface PersistentPaperStates {
        archived: string[]; // filenames marked as archived
        deleted: string[];  // filenames marked as deleted
      }
      ```
    - `fetchPersistentPaperStates()` downloads and parses `paper_states.json` from Supabase Storage. If missing or on first run, it initializes an empty structure.
    - `savePersistentPaperStates(states)` serializes and uploads the updated state back to Supabase Storage with cache control `no-cache`, ensuring immediate global consistency across all edge/serverless workers.
  - **Defensive Local Filesystem Synchronization**:
    - Local filesystem operations (`fs.renameSync`, `fs.unlinkSync`) are retained for offline local development ergonomics, but are strictly wrapped in defensive `try / catch` blocks.
    - When executed locally, physical files move into `staging/archive/` or are unlinked.
    - When executed on cloud serverless runtimes, filesystem errors (`ENOENT`, `EROFS`) are caught gracefully and logged, while state transitions persist authoritatively via Supabase Storage.
  - **Full Lifecycle Operations**:
    - **Archive**: Adds paper filename to `archived`, removes from `deleted`. Tries local move to `staging/archive/`.
    - **Unarchive**: Removes paper filename from `archived`. Tries local move back to `staging/`.
    - **Delete**: Adds paper filename to `deleted`, removes from `archived`. Tries local file unlink.
    - **List / Discovery (`GET /api/ingest/staged-paper`)**: Filters available papers against remote `archived` and `deleted` sets, ensuring accurate client state regardless of serverless container state.

### 2. Incident 2: Next.js App Router Route Export Typecheck Constraint
- **Problem**:
  - Running `next build` during Vercel deployment triggered a strict TypeScript compilation failure:
    ```
    Type error: Route "app/api/ingest/staged-paper/route.ts" does not match the required types of a Next.js Route.
      "fetchPersistentPaperStates" is not a valid Route export field.
    ```
- **Root Cause**:
  - Next.js App Router enforces strict static type definitions on route handler files (`app/**/route.ts` or `app/**/route.js`).
  - Next.js only allows specific exports from route files: valid HTTP method handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) and specific route segment config options (`dynamic`, `dynamicParams`, `revalidate`, `fetchCache`, `runtime`, `preferredRegion`, `maxDuration`).
  - Exporting helper functions or utility procedures directly from `route.ts` (e.g., `export async function fetchPersistentPaperStates(...)`) to share them with test scripts or external modules violates the Next.js Route type contract and breaks the build.
- **Architectural Solution: Strict Library Decoupling**:
  - Extracted all persistence logic, state schemas, and Supabase Storage interactions into a dedicated library module:
    [`lib/ingestion/stagedPaperStorage.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/ingestion/stagedPaperStorage.ts).
  - Restricted exports in [`app/api/ingest/staged-paper/route.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/api/ingest/staged-paper/route.ts) exclusively to the HTTP route handlers: `GET` and `POST`.
  - Route handlers and verification scripts import utilities directly from `@/lib/ingestion/stagedPaperStorage`, preserving clean architectural separation of concerns and full Next.js App Router type safety.

### 3. Key Architectural Takeaways & Anti-Patterns
- **Anti-Pattern: Local Disk Reliance in Serverless APIs**:
  - Never assume `process.cwd()` is writable or persistent in Next.js API routes deployed to cloud platforms (Vercel, AWS Lambda, Cloud Run). Local disk writes must always have remote cloud persistence (Database or Object Storage) as the primary source of truth, treating local disk operations as opportunistic dev-only enhancements wrapped in defensive handlers.
- **Anti-Pattern: Utility Exports from Next.js Route Handlers**:
  - Never export arbitrary helper functions, types, or test utilities from `app/**/route.ts`. Route files should serve strictly as thin transport adapters mapping incoming HTTP requests to domain logic located in `lib/` or `services/`.
- **Hybrid Storage Pattern for Serverless Metadata**:
  - Using Supabase Storage as a lightweight document store (`paper_states.json`) avoids schema migration overhead for simple operational metadata while providing instant global edge consistency.

### 4. Verification & Validation Results
- **Dedicated Automated Verification (`scripts/verify-staged-paper-sync.ts`)**:
  - 59 / 59 tests passing across mock and storage synchronization suites.
  - Verified archive, unarchive, delete, and discovery filtering with simulated read-only filesystem environments.
- **Strict TypeScript & Build Validation**:
  - `next build` executed and verified with 0 errors, validating all Route export constraints and type contracts.
- **Production Verification**:
  - Live deployment on Vercel verified `● Ready` with clean HTTP 200 responses.


## Reflection Log Entry - 2026-10-14 (Diagram CDN Architecture, Supabase Storage Synchronization, & Test Compiler Resilient Print Pipeline)

- **Date**: 2026-10-14
- **Topic**: Diagram CDN Architecture, Supabase Storage Synchronization, and Test Compiler Dynamic Resilient Print Pipeline
- **Target Surfaces**:
  - Diagram CDN Canonicalizer: [`lib/resolveDiagramUrl.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/resolveDiagramUrl.ts)
  - Question Data Layer & Mappings: [`lib/questions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts)
  - Tactile Diagram Preview & Lightbox Modal: [`components/portal/compiler/CompilerDiagramPreview.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/CompilerDiagramPreview.tsx)
  - Test Compiler Configuration & Compilation Logic: [`lib/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts)
  - Test Compiler State Hub: [`components/portal/compiler/TestCompilerHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/TestCompilerHub.tsx)
  - Compiler Print View & Multi-Tier Resolution: [`app/portal/compiler/print/page.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/portal/compiler/print/page.tsx)
  - Compiler Type Definitions: [`types/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/types/testCompiler.ts)
  - Printable Exam Layout: [`components/portal/compiler/PrintableExamLayout.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/PrintableExamLayout.tsx)
  - Storage Migration & Verification Scripts: [`scripts/upload-all-diagrams-to-storage.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/upload-all-diagrams-to-storage.ts), [`scripts/verify-diagram-resolution.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-diagram-resolution.ts), [`scripts/verify-compiler-diagram-preview.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-compiler-diagram-preview.ts), [`scripts/verify-compiler-print-pipeline.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-compiler-print-pipeline.ts)

### 1. Topic 1: Diagram CDN Architecture & Supabase Storage Synchronization
- **Problem**:
  - Cambridge Economics exam diagrams (e.g. 0455/13 Oct/Nov 2024 Q18) consistently failed to render (HTTP 404 Not Found) in the Test Compiler on remote Vercel deployments and in fresh git worktrees.
  - Diagram images displayed broken placeholder icons or disrupted printed layout flow.
- **Root Cause**:
  1. *Local-Only Asset Storage*: Diagram PNGs only existed on local disk in `public/questions/` and were untracked/ignored by git. Remote serverless environments on Vercel and newly created git worktrees lacked these physical files entirely.
  2. *Unpopulated Remote Object Storage*: The Supabase Storage bucket `question-diagrams` had been created but was completely empty (0 objects uploaded).
  3. *Relative Path Database Drift*: The Supabase `questions` table stored diagram references as local relative path strings (e.g. `image_url: "/questions/0455_2024_w_13_q18.png"`), preventing clients from fetching assets from a globally distributed CDN.
  4. *Lack of Defensive Error Handling in UI*: In [`components/portal/compiler/TestCompilerHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/TestCompilerHub.tsx), question diagrams were rendered via unadorned `<img>` elements without error boundary fallbacks, retry handlers, or zoom modal inspection.
- **Architectural Resolution & Implementation**:
  - **Bulk Asset Ingestion to Supabase Storage**:
    - Created and executed [`scripts/upload-all-diagrams-to-storage.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/upload-all-diagrams-to-storage.ts) to upload all 267 Cambridge diagram PNGs across 2022, 2023, and 2024 series directly to the public `question-diagrams` bucket in Supabase Storage with content-type `image/png` and cache-control headers (`public, max-age=31536000, immutable`).
    - Synchronized database records: updated `questions.image_url` fields to direct public CDN endpoints:
      `https://<project-id>.supabase.co/storage/v1/object/public/question-diagrams/<filename>`.
  - **Transparent CDN URL Canonicalization ([`lib/resolveDiagramUrl.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/resolveDiagramUrl.ts))**:
    - Implemented a canonical resolver [`resolveDiagramUrl`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/resolveDiagramUrl.ts) that gracefully handles all diagram string permutations:
      ```typescript
      export function resolveDiagramUrl(url?: string | null): string | undefined {
        if (!url || typeof url !== 'string') return undefined;
        const trimmed = url.trim();
        if (!trimmed) return undefined;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
          return trimmed;
        }
        const cleanBasename = trimmed.split('/').pop()?.split('?')[0];
        if (!cleanBasename) return undefined;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
        const normalizedBase = supabaseUrl.replace(/\/+$/, '');
        return `${normalizedBase}/storage/v1/object/public/question-diagrams/${cleanBasename}`;
      }
      ```
    - Embedded this resolver in [`lib/questions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts) (`mapDbQuestionToQuestion`) so every question queried from Supabase automatically has its `image_url` resolved to CDN before reaching React components.
  - **Tactile Neobrutalist Diagram Preview & Lightbox ([`CompilerDiagramPreview.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/CompilerDiagramPreview.tsx))**:
    - Created a dedicated preview component replacing raw `<img>` tags.
    - *Defensive Error Fallback*: If the primary CDN image fails to load, attempts a fallback to local relative paths. If both fail, displays a neobrutalist warning state (`bg-[#ffeaec] border-[#201e1d]`) with an interactive `[Retry Image]` button that increments retry counters and re-triggers image evaluation.
    - *High-Res Lightbox Modal*: Features a zoom trigger (`[🔍 Zoom]`) opening an accessible full-screen overlay rendered via `createPortal(..., document.body)`. Supports keyboard `Escape` dismissal, outside-click backdrop closure, and strict §12 tween transitions (`type: "tween"`, duration `0.2s`, `easeOut`).
    - *Layout Integration*: Applied across [`TestCompilerHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/TestCompilerHub.tsx), [`PrintableExamLayout.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/PrintableExamLayout.tsx), and [`QuestionCard.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/QuestionCard.tsx).

---

### 2. Topic 2: Test Compiler Dynamic Print Pipeline & Blank PDF Resolution
- **Problem**:
  - Navigating to `/portal/compiler/print?testId=...` to generate printable PDF assessments or paper exam handouts resulted in a completely blank PDF template with 0 questions rendered, empty question grids, and missing bubble sheets.
- **Root Cause**:
  1. *Hardcoded Mock Pool Coupling in Compiler Engine*:
     - In [`components/portal/compiler/TestCompilerHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/TestCompilerHub.tsx), the active question bank fetches live questions from Supabase with UUID primary keys (e.g. `24c7f074-...`).
     - However, [`buildCompiledQuestions`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts) in [`lib/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts) hardcoded lookups strictly against the static [`CAMBRIDGE_QUESTIONS`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts) array (30 legacy mock questions with IDs like `cam_0455_m24_12_q1`).
     - When matching UUIDs from Supabase against `CAMBRIDGE_QUESTIONS`, lookups returned `undefined`, resulting in an empty compiled question list (`[]`) and 0 total marks.
  2. *Lossy Draft Persistence in LocalStorage*:
     - `saveTestDraft` in `localStorage` only recorded `questionIds: string[]`. When a user opened `/portal/compiler/print?testId=...` in a new browser tab or without pre-loaded state, the print page could not reconstruct the questions without access to the live query pool.
  3. *Synchronous Print Route Assumption*:
     - [`app/portal/compiler/print/page.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/portal/compiler/print/page.tsx) loaded synchronously from `loadTestDraft(testId)`. Because it had no asynchronous database fetching mechanism, any test draft containing database IDs failed to compile and rendered a blank document without error feedback.
- **Architectural Resolution & Multi-Tier Resilient Pipeline**:
  - **Decoupled Question Pool Compilation ([`lib/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts))**:
    - Refactored [`buildCompiledQuestions(questionIds, pool?)`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts#L48-L86) and [`autoSelectQuestions(options, pool?)`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts#L88-L121) to accept an optional dynamic `pool?: Question[]`.
    - Resolution order: searches `primaryPool` first, falling back to [`CAMBRIDGE_QUESTIONS`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts) only if the item is not found in the custom pool.
    - Resolves diagram URLs during compilation using [`resolveDiagramUrl`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/resolveDiagramUrl.ts).
  - **Schema Extension & Full Snapshot Persistence ([`types/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/types/testCompiler.ts))**:
    - Extended [`TestPaperConfig`](file:///Users/joelchong/Documents/MCQ%20App/Anti/types/testCompiler.ts#L1-L18) with optional `compiledQuestions?: CompiledExamQuestion[]`.
    - When saving drafts in [`TestCompilerHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/TestCompilerHub.tsx), the full snapshot of compiled exam questions (stem markdown, options, correct answer flags, resolved diagram URLs, syllabus topics, and citations) is persisted directly into the draft payload.
  - **Multi-Tier Resilient Print Route Pipeline ([`app/portal/compiler/print/page.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/portal/compiler/print/page.tsx))**:
    - Re-architected `/portal/compiler/print` with a 3-tier loading strategy:
      1. *Tier 1 (Instant Snapshot)*: If `loadedConfig.compiledQuestions` is populated, render immediately without network roundtrips.
      2. *Tier 2 (Asynchronous Database Fallback)*: If snapshot is missing but `questionIds` has UUIDs, execute [`fetchQuestionsFromDb({ questionIds: loadedConfig.questionIds })`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts) from Supabase, pass the result into [`buildCompiledQuestions(questionIds, dbQuestions)`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts), and render dynamically.
      3. *Tier 3 (Static Mock Fallback)*: If network fails or IDs are legacy mock IDs, compile against [`CAMBRIDGE_QUESTIONS`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts).
    - *Defensive Error Recovery State*: If the draft is completely missing or corrupted, renders a neobrutalist empty state card detailing local storage scope, accompanied by clear CTAs:
      - `[← Return to Test Compiler]`: Returns to compiler hub.
      - `[⚡ Load Sample Demo Test]`: Instantly loads sample Cambridge questions with bubble sheet and mark scheme so printing can proceed without interruption.

---

### 3. Key Architectural Takeaways & Anti-Patterns
- **Anti-Pattern: Static Mock Lookups in Dynamic Compilation Pipelines**:
  - Never hardcode lookups against static arrays (`CAMBRIDGE_QUESTIONS.find(...)`) in compilation or transformation utilities when the system operates on dynamic, database-backed records. Always allow a dynamic entity pool to be injected with fallback cascading.
- **Anti-Pattern: Unhydrated ID References in Cross-Route Local Storage**:
  - Persisting only entity IDs (`questionIds: string[]`) across browser routes (such as navigating from an editor to a dedicated print window) creates brittle dependencies on pre-warmed memory or synchronous stores. Always snapshot self-contained rendered models (`compiledQuestions`) alongside IDs at save time.
- **Anti-Pattern: Raw `<img>` Tags in Production Content Pipelines**:
  - In educational applications where questions depend on diagrams, unhandled `<img>` tags lead to silent layout degradation. Always encapsulate media in a defensive preview component that combines CDN canonicalization, failure state recovery with retry CTAs, and zoom lightbox inspection.
- **Anti-Pattern: Synchronous Printing Assumption in Next.js App Router**:
  - Client-side print views (`/print`) must never assume data is synchronously available at initial render. Implement multi-tier asynchronous hydration with clear loading skeletons and defensive empty state fallbacks.

---

### 4. Verification & Validation Results
- **Supabase Storage & CDN Verification ([`scripts/verify-diagram-resolution.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-diagram-resolution.ts))**:
  - 100% pass rate across all checks:
    - 267 diagram PNGs verified in Supabase Storage bucket `question-diagrams`.
    - Live HTTP 200 GET probes confirmed on Supabase CDN endpoints across 2022, 2023, and 2024 series (including target 0455/13 Oct/Nov 2024 Q18: `0455_2024_w_13_q18.png`).
    - Verified `resolveDiagramUrl` handles null, empty, absolute CDN URLs, relative paths (`/questions/...`), and plain filenames.
- **Compiler Diagram Component Verification ([`scripts/verify-compiler-diagram-preview.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-compiler-diagram-preview.ts))**:
  - Validated fallback badge, retry interaction handler, portal mount, and §12 compliant tween animations.
- **Print Pipeline Verification ([`scripts/verify-compiler-print-pipeline.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-compiler-print-pipeline.ts) & [`scripts/verify-compiler-print.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-compiler-print.ts))**:
  - Verified `buildCompiledQuestions` and `autoSelectQuestions` with custom database question pools and fallback cascading.
  - Verified snapshot persistence via `saveTestDraft` / `loadTestDraft`.
  - Verified dynamic database fallback and error CTA state in `PrintPageContent`.
- **Strict TypeScript & Build Safety**:
  - All type definitions in [`types/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/types/testCompiler.ts) validated with 0 type errors.


## Reflection Log Entry - 2026-10-14 (Staged Paper Supabase Sync, Lifecycle Archiving & Dual Quality Gate Integration)

- **Date**: 2026-10-14
- **Topic**: Staged Paper Supabase Sync, Lifecycle Archiving & Dual Quality Gate Integration
- **Target Surfaces**:
  - Staged Paper API Endpoint: [`app/api/ingest/staged-paper/route.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/api/ingest/staged-paper/route.ts)
  - Ingestion State Store: [`lib/ingestion/useIngestionStore.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/ingestion/useIngestionStore.ts)
  - Ingestion Header & Post-Publish Actions: [`components/portal/IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx)
  - Pipeline Execution Modal: [`components/portal/IngestionPipelineModal.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPipelineModal.tsx)
  - Staging Review Orchestrator: [`components/portal/StagingReview.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/StagingReview.tsx)
  - Dual Quality Gate Queue Matrix: [`components/portal/staged/StagedPapersQueue.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/staged/StagedPapersQueue.tsx)
  - Dual Quality Gate Auditor Mode: [`components/portal/staged/StagedPaperAuditor.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/staged/StagedPaperAuditor.tsx)
  - Ingestion Data Schemas & Contracts: [`types/ingestion.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/types/ingestion.ts)
  - Automated Verification Suite: [`scripts/verify-staged-paper-sync.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-staged-paper-sync.ts)

### 1. Architectural Insights & Implementations

#### Insight 1: Local Filesystem Staging vs. Remote Database Sync
- **Challenge**:
  - Staged papers reside on disk as decoupled JSON payloads in `staging/*.json` (e.g. `0455_s24_12.json`).
  - Previously, the staging queue had no awareness of whether a paper had already been published to Supabase. This resulted in curators inadvertently republishing existing papers, or lacking visibility into live paper status within the staging triage UI.
- **Architectural Solution**:
  - In [`app/api/ingest/staged-paper/route.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/api/ingest/staged-paper/route.ts), extended `GET` handler to perform real-time cross-referencing against Supabase:
    1. Scan `staging/` on local disk for all staged paper JSON manifests.
    2. Query the Supabase `papers` table joined with `subjects` (`select('id, year, series, paper_code, subjects(code)')`).
    3. Match each staged paper's metadata (`subject_code`, `year`, `series`, `paper_number`) against remote database records.
    4. Dynamically enrich each staged paper descriptor with `is_published: boolean`, `lifecycle_state: 'published' | 'staged'`, and the remote `database_id` when present.
  - This guarantees that once a past paper is ingested and published to the live database, the staging queue immediately reflects its live published status without needing local file mutations or separate database flags.

#### Insight 2: Staged Paper Lifecycle & Archive Architecture
- **Challenge**:
  - As past papers progress through review and publishing, curators needed atomic mechanisms to archive completed papers, unarchive them if further curation is needed, or delete unwanted staging files without manual filesystem manipulation.
  - APIs handling filesystem operations must be rigorously protected against path traversal vulnerabilities (e.g. `../../etc/passwd` or malicious directory escapes).
- **Architectural Solution**:
  - Implemented atomic `archive`, `unarchive`, and `delete` operations in `POST /api/ingest/staged-paper`:
    - **Atomic Archiving**: Moves paper JSON files from `staging/<filename>.json` to `staging/archive/<filename>.json`, automatically creating `staging/archive/` if it does not exist.
    - **Atomic Unarchiving**: Restores archived files from `staging/archive/<filename>.json` back to active `staging/<filename>.json`.
    - **Atomic Deletion**: Safely unlinks files from disk when explicitly requested by an authorized curator.
  - **Directory Traversal Defense**:
    - Enforced strict regex whitelist validation on paper identifiers: `/^[a-zA-Z0-9_\-]+$/`.
    - Any payload containing path separators (`/`, `\`), null bytes, or relative traversal sequences (`..`) is immediately rejected with HTTP 400 Bad Request before any filesystem interaction occurs.

#### Insight 3: Post-Publish Action Rails
- **Challenge**:
  - After publishing a staged paper to Supabase via [`IngestionPipelineModal.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPipelineModal.tsx) or [`IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx), curators had to manually navigate back to staging review to archive the local JSON file.
- **Architectural Solution**:
  - Implemented 1-click post-publish action rails:
    - Added `archiveStagedPaper(paperId)` action to [`useIngestionStore.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/ingestion/useIngestionStore.ts).
    - Integrated direct `[Archive Staged File]` buttons into the post-publish receipt modals in [`IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx), [`StagingReview.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/StagingReview.tsx), and [`IngestionPipelineModal.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPipelineModal.tsx).
    - Curators can instantly move published files to `staging/archive/` directly from the success receipt modal, streamlining local workspace hygiene.

#### Insight 4: Framer Motion Tween Override (§12)
- **Incident & Rule**:
  - When rendering animated pulse effects, badges, or notification indicators with keyframe arrays (e.g. `scale: [1, 1.05, 1]`), Motion's default spring animation engine throws an unrecoverable runtime error:
    `Error: Only two keyframes currently supported with spring and inertia animations. Trying to animate 1,1.05,1`.
- **Architectural Remediation**:
  - In compliance with Motion physics standards (§12), explicitly enforced `type: "tween"` with specified durations (e.g. `duration: 0.3, ease: "easeOut"`) across all multi-keyframe transform animations.
  - Ensured spring configurations (`type: "spring"`, `stiffness: 400`, `damping: 25`) are strictly reserved for 2-state transitions (e.g. open/close drawer transforms or tactile button presses).

#### Insight 5: Merge & Rebase Reconciliation (Dual Quality Gate Workflow)
- **Context & Reconciliation**:
  - During rapid concurrent development, `StagingReview.tsx` underwent a substantial redesign:
    1. Branch A introduced the **2-Mode Quality Gate**:
       - `StagedPapersQueue.tsx`: High-level multi-paper triage matrix with visual health bars, status badges, and JSON drag-and-drop ingestion.
       - `StagedPaperAuditor.tsx`: High-speed single-paper review mode with 10x hotkey accelerators (`1-4`, `A-D`, `F` to flag, arrow keys to cycle).
       - `StagingReview.tsx`: Thin orchestrator managing mode switching between Queue and Auditor.
    2. Branch B introduced live Supabase status cross-referencing and archive/unarchive lifecycle endpoints.
  - Successfully reconciled and unified both architectural branches:
    - Integrated live publication sync (`is_published`, `lifecycle_state`) into `StagedPapersQueue` paper cards and triage table columns.
    - Wired atomic archive/unarchive action callbacks into both Queue actions and Auditor header controls.
    - Preserved zero-latency hotkeys and state persistence across mode transitions.

---

### 2. Key Architectural Takeaways & Anti-Patterns

- **Anti-Pattern: Disconnected Local & Remote Content States**:
  - File-based staging pipelines must never operate as black-box silos disconnected from the authoritative database. Cross-referencing staged artifacts against live database records on read provides instantaneous visibility into publishing state without requiring fragile manual status synchronization.
- **Defensive API File Operations**:
  - Always validate file and identifier inputs with strict regex whitelists (`/^[a-zA-Z0-9_\-]+$/`) prior to filesystem operations to eliminate path traversal vulnerabilities at the API boundary.
- **Framer Motion Multi-Keyframe Rule**:
  - Array keyframes (`[a, b, c]`) on transform properties (`scale`, `x`, `y`, `rotate`) MUST always specify `type: "tween"`. Motion's spring solver only supports two keyframes.
- **Closed-Loop Post-Publish UX**:
  - In multi-step publishing workflows, always surface direct lifecycle cleanup actions (such as 1-click archiving) on the completion receipt screen, minimizing cognitive friction and workspace clutter.

---

### 3. Verification & Validation Summary

- **Automated Verification Suite ([`scripts/verify-staged-paper-sync.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-staged-paper-sync.ts))**:
  - Verified live Supabase database sync: validated `is_published === true` and `lifecycle_state === 'published'` for published paper `0455_s24_12`.
  - Verified atomic archive: confirmed temporary staged JSON correctly moved to `staging/archive/` and verified removal from `staging/`.
  - Verified atomic unarchive: confirmed file restored from `staging/archive/` to `staging/`.
  - Verified security guards: confirmed traversal attacks (`../../etc/passwd`, `../secret`, `a/b`) properly rejected with HTTP 400.
  - Verified error handling: confirmed malformed payloads return 400, non-existent files return 404.
- **TypeScript & Type Contract Validation**:
  - Strict type contracts in [`types/ingestion.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/types/ingestion.ts) verified with 0 type errors.

## Reflection Log Entry - 2026-10-15 (Staged & Archived Papers Deletion, Defensive Modals & Ingestion Store State Lifecycle)

- **Date**: 2026-10-15
- **Topic**: Staged & Archived Papers Deletion, Defensive Modals, and Ingestion Store State Lifecycle
- **Background**: In Cambridge Ingestion Studio, users previously could only archive or restore papers, with no option to delete them. This led to unnecessary staging clutter and required manual disk interventions. The objective was to add permanent deletion across active staging and archives with defensive modal confirmation, store state resetting, and dual-layer local/remote persistence synchronization.
- **Target Surfaces**:
  - Ingestion Staged Paper API: [`app/api/ingest/staged-paper/route.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/api/ingest/staged-paper/route.ts)
  - Ingestion State Store: [`lib/ingestion/useIngestionStore.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/ingestion/useIngestionStore.ts)
  - Ingestion Setup Wizard: [`components/portal/IngestionSetupWizard.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionSetupWizard.tsx)
  - Ingestion Header: [`components/portal/IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx)
  - Quality Gate Staged Papers Queue: [`components/portal/staged/StagedPapersQueue.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/staged/StagedPapersQueue.tsx)
  - Backend Verification Suite: [`scripts/verify-delete-papers.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-delete-papers.ts)
  - UI & Store Verification Suite: [`scripts/verify-ui-delete-papers.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-ui-delete-papers.ts)

### 1. Architectural Patterns & Implementations

#### Pattern 1: Universal Deletion UI & Tactile Confirmation Modals
- **Challenge**:
  - Permanent paper deletion is an irreversible destructive operation. Providing delete triggers without sufficient visual friction or confining deletion to only one surface leads to accidental deletions or fragmented curator workflows.
- **Architectural Solution**:
  - Added tactile Neobrutalist Delete buttons (`Trash2` icon, rose styling `bg-[#FFE2E2] text-rose-700 hover:bg-rose-600 hover:text-white border-2 border-[#2B2B2B] shadow-[2px_2px_0px_#2B2B2B]`) paired with prominent confirmation modals across all primary curation surfaces:
    1. **[`IngestionSetupWizard.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionSetupWizard.tsx)**: Delete actions and tactile confirmation dialogs for both active drafts and archived papers in the paper selection drawer.
    2. **[`IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx)**: Ingestion header toolbar delete action for the active curation studio session.
    3. **[`StagedPapersQueue.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/staged/StagedPapersQueue.tsx)**: Direct deletion button in the Admin Quality Gate matrix for both active queue rows and archived table rows.
  - Every surface incorporates a high-friction confirmation dialog requiring deliberate curator confirmation before dispatching deletion requests.

#### Pattern 2: Multi-Environment Persistence Synchronization (Local Disk + Supabase Storage)
- **Challenge**:
  - The application runs both locally in development (with full read/write filesystem access to `staging/*.json` and `staging/archive/*.json`) and in read-only serverless edge environments (Vercel production).
  - In serverless deployments, modifying local files on disk is either prohibited or ephemeral. Deleting a paper only on disk fails in cloud environments, while deleting only in cloud leaves orphan files in local dev.
- **Architectural Solution**:
  - In [`app/api/ingest/staged-paper/route.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/api/ingest/staged-paper/route.ts), implemented synchronized deletion handling:
    1. **Local Filesystem Unlinking**: Attempts `fs.promises.unlink` on both active `staging/<filename>.json` and archived `staging/archive/<filename>.json` paths, gracefully ignoring `ENOENT` if the file only existed in one location or remote store.
    2. **Remote Supabase Storage Sync**: Queries `staged_metadata/paper_states.json` under the `question-diagrams` bucket. If present, removes the paper key/metadata entry and re-uploads the sanitized manifest to Supabase Storage.
    3. Guarantees deterministic state consistency regardless of whether the runtime environment is local Node.js or a Vercel read-only serverless lambda.

#### Pattern 3: Defensive Ingestion Store Lifecycle Management
- **Challenge**:
  - If a curator deletes a staged paper that happens to be currently loaded in active workspace memory or localStorage (`useIngestionStore`), stale state remains visible. Subsequent auto-saves or edits could resurrect the deleted paper or corrupt store state.
- **Architectural Solution**:
  - In [`lib/ingestion/useIngestionStore.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/ingestion/useIngestionStore.ts), enhanced `deleteStagedPaper` with multi-identifier matching:
    - Checks if the deleted paper matches active workspace state via:
      a) Explicit paper ID match (`metadata.paper_code` / `currentPaperId`),
      b) Derived Cambridge naming code (e.g. `0455_s24_12` constructed from `subject_code`, `series`, `year`, `paper_number`), or
      c) Source filename cross-check.
    - If a match is detected:
      - Immediately invokes store `resetState()` to blank the active canvas.
      - Clears undo/redo history stacks.
      - Wipes stale `localStorage` draft keys (`revizz_ingestion_state_*`).
      - Navigates the curator smoothly back to the paper selector queue.

#### Pattern 4: Security Hardening & Directory Traversal Defense
- **Challenge**:
  - File deletion endpoints accept identifier strings from client requests. Unsanitized inputs risk arbitrary file deletion outside intended staging directories.
- **Architectural Solution**:
  - Enforced strict directory traversal guards rejecting `..`, `/`, and `\` payloads with immediate HTTP 400 Bad Request responses before any filesystem operation.
  - Sanitized identifiers against strict alphanumeric regex (`/^[a-zA-Z0-9_\-]+$/`).
  - Resolved absolute target paths and validated containment within designated `staging/` or `staging/archive/` base folders.

---

### 2. Verification, Validation & Production Deployment

- **Automated Verification Suites**:
  - **Backend API & Storage Sync Suite ([`scripts/verify-delete-papers.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-delete-papers.ts))**:
    - 76/76 passing assertions verifying active staging file deletion, archive file deletion, remote Supabase metadata synchronization, directory traversal attack rejection (`..`, `/`, `\`), and 400/404 defensive handling.
  - **UI & Store Contract Suite ([`scripts/verify-ui-delete-papers.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-ui-delete-papers.ts))**:
    - 20/20 passing assertions verifying modal state contracts, store `deleteStagedPaper` state resets, localStorage cleanup, and component binding integrity across `IngestionSetupWizard`, `IngestionHeader`, and `StagedPapersQueue`.
  - **TypeScript Compilation**:
    - Full codebase compilation check (`npx tsc --noEmit`) verified with 0 errors.
- **Production Deployment**:
  - Atomic live release pushed to `origin/main` (commit `c80c93c`).
  - Remote Vercel production build succeeded: `● Ready`.

## Reflection Log Entry - 2026-10-15 (Ingestion Studio UI Overhaul: Typography Harmonization, Compact 2-Row Nav & Toolbar Ergonomics)

- **Date**: 2026-10-15
- **Topic**: Ingestion Studio UI Overhaul: Typography Harmonization, 2-Row Question Navigation, Icon Normalization, Toolbar Pruning & Worktree Atomic Push
- **Background**: The Cambridge Past Paper Ingestion Studio had accrued visual noise, layout fragmentation, and font inconsistencies over multiple iterations. Student-facing gaming display fonts (`Caprasimo`) leaked into high-density admin curation surfaces, header toolbars suffered from button fatigue (8+ competing actions), question navigation consumed excessive vertical space (~240px), and missing PDF attachments left blank uninformative canvases.
- **Target Surfaces**:
  - Ingestion Header: [`components/portal/IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx)
  - Ingestion Hub: [`components/portal/IngestionHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHub.tsx)
  - Question Navigator: [`components/portal/IngestionQuestionNav.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionQuestionNav.tsx)
  - PDF Viewer & Cropper: [`components/portal/IngestionPdfViewer.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPdfViewer.tsx)
  - Dual-Pane Workspace: [`components/portal/IngestionWorkspace.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionWorkspace.tsx)
  - Question Stem Editor: [`components/portal/IngestionStemEditor.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionStemEditor.tsx)
  - Options Editor: [`components/portal/IngestionOptionsEditor.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionOptionsEditor.tsx)
  - Pipeline Modal: [`components/portal/IngestionPipelineModal.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPipelineModal.tsx)

### 1. Architectural Patterns & Implementations

#### Pattern 1: §15.2 Font Harmonization & Design System Enclosure
- **Challenge**:
  - The student-facing gaming font `Caprasimo` (`font-heading`) had inadvertently crept into administrative curation headers, modal titles, and navigation chips. `Caprasimo` is intentionally playful, rounded, and expressive for student quizzes, but drastically compromises readability and professional information density in multi-field admin curation tools.
- **Architectural Solution**:
  - Standardized all Ingestion Studio surfaces to the Revizz admin typographic triad:
    1. **Primary Admin Headings & Labels**: `Space Grotesk` (`font-adminHeading`), providing high-legibility geometric structure.
    2. **Code, Tags, Metadata & Cambridge Citations**: `JetBrains Mono` (`font-mono`), maintaining tabular numeric alignment for paper codes, question numbers, and LaTeX math.
    3. **General Body & Description Copy**: `Figtree` (`font-body`), ensuring crisp neutral prose across multi-line stems, explanations, and distractor rationale.
  - Refactored all references in [`IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx), [`IngestionQuestionNav.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionQuestionNav.tsx), [`IngestionStemEditor.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionStemEditor.tsx), [`IngestionOptionsEditor.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionOptionsEditor.tsx), [`IngestionPdfViewer.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPdfViewer.tsx), and [`IngestionWorkspace.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionWorkspace.tsx).

#### Pattern 2: Icon String Normalization & Defensive Fallbacks
- **Challenge**:
  - Cambridge subject metadata stored in staged JSON files occasionally contained literal icon names (e.g. `"trending-up"` for Economics, `"atom"` for Physics, `"flask"` for Chemistry) instead of Unicode emoji characters. When rendered directly as `{subjectIcon}`, the raw text string `"trending-up"` was displayed next to paper codes.
- **Architectural Solution**:
  - Implemented a defensive `renderSubjectIcon(icon?: string)` helper in [`IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx):
    - Sanitizes and normalizes incoming icon strings (case-insensitive substring matching).
    - Safely maps known Lucide icon keywords:
      - `trending-up` / `econ` $\rightarrow$ `<TrendingUp className="w-4 h-4 text-[#c67139]" />`
      - `atom` / `physics` $\rightarrow$ `<Atom className="w-4 h-4 text-[#c67139]" />`
      - `flask` / `chemistry` $\rightarrow$ `<FlaskConical className="w-4 h-4 text-[#c67139]" />`
      - `calculator` / `math` $\rightarrow$ `<Calculator className="w-4 h-4 text-[#c67139]" />`
      - `globe` / `geography` $\rightarrow$ `<Globe className="w-4 h-4 text-[#c67139]" />`
    - Seamlessly falls back to rendering literal emoji glyphs or a clean default document badge (`📝`).
    - Applied consistently across the header paper title, archive confirmation modal, and deletion confirmation modal.

#### Pattern 3: Button Fatigue Elimination (§5.3) & Hierarchical Toolbar Architecture
- **Challenge**:
  - The top header toolbar had become visually cluttered with 8+ competing buttons (Undo, Redo, Settings, Payloads, Audit, Preview, Delete Staged Paper, Upsert to Supabase), causing severe button fatigue, cognitive hesitation, and frequent accidental clicks.
- **Architectural Solution**:
  - Streamlined the header into a clean 2-group hierarchy:
    1. **High-Frequency Primary Actions**:
       - Primary CTA: `[Upsert to Supabase]` (or active `Live in Supabase` status pill with clean `[Archive Draft]` action).
       - Contextual Preview Toggle: `[👁 Preview]` drawer toggle.
       - Quick PDF Collapse/Expand toggle on the workspace boundary.
    2. **Secondary Tool Consolidation (`[···]` More Actions Dropdown)**:
       - Unified secondary tools into a neobrutalist popover menu (`MoreHorizontal` icon trigger):
         - Inline History controls (Undo `Ctrl+Z` / Redo `Ctrl+Y`).
         - Paper Settings (`Settings` icon).
         - JSON Payload Inspector (`FileCode` icon).
         - Ingestion Audit Drawer (`SlidersHorizontal` icon).
         - Destructive Deletion: Staged Paper Deletion (`Trash2` icon with rose-red styling) with defensive confirmation dialog.

#### Pattern 4: Compact 2-Row Question Navigation & Toggleable 30-Question Matrix Grid
- **Challenge**:
  - Ingestion question navigation consumed ~240px of vertical height across multiple stacked rows of filters, search inputs, counters, and chips, squeezing the authoring canvas on laptop viewports.
- **Architectural Solution**:
  - Re-architected [`IngestionQuestionNav.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionQuestionNav.tsx) into a compact 2-row layout, reclaiming ~160px of vertical reading space:
    - **Row 1 (Command Row)**: Inline search input, quick filter status chips (`All`, `Valid`, `Review`, `Has Diagram`), previous/next stepper buttons (`ChevronLeft` / `ChevronRight`), view mode switch, and `[+ New]` button.
    - **Row 2 (Navigator Row with Dual Views)**:
      - **Strip View (Default)**: Sleek, horizontally scrollable chips strip with dynamic color indicators (`#728157` valid green, `#c67139` review amber, `#b91c1c` error rose) and key indicator badge.
      - **Matrix Grid View (Toggleable)**: A full-paper overview grid (`LayoutGrid` icon) displaying all 30-40 questions simultaneously with diagram badges and answer keys, ideal for batch audits.

#### Pattern 5: Interactive PDF Dropzone & Proportional Dual-Pane Layout
- **Challenge**:
  - The dual-pane layout previously gave 46%-48% width to the PDF viewer, compressing the question editor and options cards. Additionally, if no source PDF was loaded, the left pane showed a static placeholder without direct drag-and-drop capability.
- **Architectural Solution**:
  - Rebalanced desktop workspace proportions in [`IngestionWorkspace.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionWorkspace.tsx) to **42% PDF / 58% Editor** (`xl:w-[42%] 2xl:w-[44%]`), providing ample room for multi-line KaTeX formulas, math blocks, and distractor rationale inputs.
  - Upgraded [`IngestionPdfViewer.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPdfViewer.tsx) empty state to a full interactive neobrutalist drag-and-drop target (`onDragOver`, `onDragLeave`, `onDrop`), supporting instant PDF and image ingestion with bounding box cropping tools.

#### Pattern 6: Worktree Rebase, Conflict Resolution & Atomic Push
- **Challenge**:
  - Concurrently developed staged paper deletion features (`c80c93c`) modified `IngestionHeader.tsx` while the UI overhaul was in progress. Merging required careful integration of the deletion action and defensive modal into the new `[···]` dropdown hierarchy.
- **Architectural Solution**:
  - Rebased `feat/ingestion-ui-10142345` cleanly on top of `c80c93c`, consolidating the delete confirmation modal and delete trigger directly into the `[···]` More Actions dropdown.
  - Verified full test regression suite with 125/125 passing tests (`scripts/verify-ingestion-v2.ts`).
  - Executed atomic release to `origin/main` (`b12b333`), guaranteeing zero work-in-progress leaks.

---

### 2. Verification & Validation Summary

- **Automated Verification Suite ([`scripts/verify-ingestion-v2.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-ingestion-v2.ts))**:
  - 125/125 passing assertions across 6 test suites:
    - Suite 1: Staging Paper Schema Validation (23/23 passed).
    - Suite 2: KaTeX Syntax Sanitizer and Validator (32/32 passed).
    - Suite 3: Bounding Box Calculations (31/31 passed).
    - Suite 4: App Router API Contracts (10/10 passed).
    - Suite 5: Audit Drawer Quality Gate Rule Calculations (14/14 passed).
    - Suite 6: Relational Upsert Payload Construction & Distractor Mapping (15/15 passed).
- **Core Revizz Test Suite ([`scripts/verify-revizz.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-revizz.ts))**:
  - 56/56 passing assertions across all 10 core game/portal verification suites.
- **TypeScript & Type Contract Validation**:
  - Full codebase compilation check (`npx tsc --noEmit`) verified with 0 errors.
- **Production Git History**:
  - Atomic live commit `b12b333`: `feat(ingestion): redesign Ingestion Studio UI with Space Grotesk typography, 2-row question nav, and streamlined toolbar`.

## Reflection Log Entry - 2026-10-15 (Navigation UI Streamlining & Worktree Isolation Release)

- **Date**: 2026-10-15
- **Task**: Removal of hardcoded "1 staged" indicator from Ingestion Studio in `AppAdminNav.tsx` & Atomic Production Release.
- **Key Learnings & Architectural Takeaways**:
  1. **Hardcoded Mock Indicators vs Dynamic Data**:
     - *Issue*: A static pill badge (`1 staged`) was hardcoded into `AppAdminNav.tsx` within the Ingestion Studio navigation button, giving misleading counts regardless of actual staging directory content.
     - *Remediation*: Removed the static badge and wrapping React fragment, restoring a clean, unified label format across navigation items.
  2. **Worktree Isolation Prevents Local Branch Contamination**:
     - *Pattern*: Local `main` had diverged from `origin/main` due to uncommitted working directory scratch files and prior WIP branches.
     - *Benefit*: Executing feature work within an isolated worktree (`.worktrees/nav-remove-staged-badge`) and rebasing strictly on `origin/main` allowed an atomic release (`git push origin feat/branch:main`) that deployed ONLY the verified commit (`60213ba`) directly to production on Vercel without leaking any unverified local scratch state.
  3. **Verification & Deployment Protocol**:
     - TypeScript compiler check (`npx tsc --noEmit`) verified 0 errors prior to push.
     - Vercel production deployment verified healthy and Ready.

## Reflection Log Entry - 2026-10-15 (Question Bank Mass Actions, Tri-State Selection & Defensive Confirmation Modal)

- **Date**: 2026-10-15
- **Feature**: Question Bank Mass Actions, Tri-State Selection & Defensive Confirmation Modal
- **Summary**:
  Engineered full-lifecycle mass operations for the Question Bank in [`components/portal/AdminTools.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/AdminTools.tsx), featuring:
  - Interactive multi-item selection with row checkboxes and a tri-state master header checkbox.
  - A persistent, sticky floating actions deck supporting high-velocity bulk operations: Mass Delete, Mass Status Update (`Live`, `Needs review`, `Agent draft`, `Flagged`), Mass Topic Assignment, and Selected JSON Export.
  - An accessible, defensive confirmation pop-up modal displaying contextual danger indicators, item counts, and scrollable affected question previews prior to committing irreversible mutations.
  - Dynamic reactive counter synchronization keeping status tabs (`All`, `Live`, `Needs review`, `Flagged`) and filtered counts strictly consistent across all operations.

### 1. Key Architectural Patterns

#### Pattern 1: Master Checkbox Tri-State Synchronization (`indeterminate` DOM ref)
- **Challenge**:
  - HTML `<input type="checkbox">` elements possess three visual states: checked, unchecked, and indeterminate (partially selected). However, standard React controlled inputs only bind `checked={boolean}`, which cannot declaratively reflect the indeterminate state in native HTML.
- **Architectural Solution**:
  - Attached a direct React DOM reference (`headerCheckboxRef = useRef<HTMLInputElement>(null)`) to the table header master checkbox.
  - Computed reactive page selection state:
    - `allPageSelected`: every item on the current page is selected.
    - `somePageSelected`: at least one, but not all, items on the current page are selected.
  - Synchronized the native DOM property via `useEffect`:
    ```tsx
    useEffect(() => {
      if (headerCheckboxRef.current) {
        headerCheckboxRef.current.indeterminate = somePageSelected && !allPageSelected;
      }
    }, [somePageSelected, allPageSelected]);
    ```
  - This guarantees accurate visual feedback across paginated tabular data grids without desynchronization between React virtual DOM state and native browser rendering.

#### Pattern 2: Event Propagation Isolation in Interactive Data Grids
- **Challenge**:
  - Clicking any table row opens the quick question editor modal (`onOpenEditor(item)`). Placing interactive selection controls (checkboxes, label wrappers) inside clickable table rows causes event bubbling, inadvertently opening the full editor when the user simply intends to toggle row selection.
- **Architectural Solution**:
  - Enforced strict event propagation isolation on both the outer container and the inner input elements:
    ```tsx
    <td
      className="p-3 w-10 text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          handleToggleSelect(item.id);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select question ${item.id}`}
        className="w-4 h-4 rounded border-2 border-[#2b2b2b] text-[#2b2b2b] focus:ring-2 focus:ring-[#ffd026] cursor-pointer"
      />
    </td>
    ```
  - Explicitly stopping event propagation at container, click, and change boundaries completely eliminates accidental modal launches during fast batch selection workflows.

#### Pattern 3: Defensive Confirmation Safety Gates
- **Challenge**:
  - Destructive batch operations (e.g. mass deleting dozens of questions or overwriting topics) carry high risk of permanent data loss or accidental batch corruption if executed via single-click triggers.
- **Architectural Solution**:
  - Built a defensive, accessible modal overlay (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="mass-action-title"`) in [`components/portal/AdminTools.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/AdminTools.tsx) governed by a decoupled state machine (`MassActionModalState`):
    - **Contextual Warning Badges**: Differentiates between destructive operations (bold crimson styling `bg-[#ffe5e5] text-[#b91c1c] border-[#b91c1c]` with warning triangle for Delete) and metadata mutations (warm honey amber styling for Status and Topic changes).
    - **Affected Item Inspection Previews**: Renders a scrollable list (`max-h-40 overflow-y-auto`) showing the exact IDs, syllabus citations, and question stems being altered, ensuring complete transparency before confirmation.
    - **Keyboard & Backdrop Safety**: Implements outside-backdrop click dismissal and native `Escape` key event listeners (`window.addEventListener('keydown', handleKeyDown)`) to enable instant abort without accidental submission.

#### Pattern 4: Boundary-Aware Pagination Clamping
- **Challenge**:
  - When all items on the current final page (e.g. Page 5 of 5) are batch-deleted, a naive state update leaves `currentPage = 5`, rendering a stranded empty table with broken pagination controls.
- **Architectural Solution**:
  - Implemented boundary-aware page recalculation in [`lib/portal/massActions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/portal/massActions.ts):
    ```ts
    export function calculateClampedPage(currentPage: number, newTotalItems: number, pageSize: number): number {
      const maxPage = Math.max(1, Math.ceil(newTotalItems / pageSize));
      return Math.min(currentPage, maxPage);
    }
    ```
  - Upon committing a deletion, `currentPage` automatically clamps to the new valid maximum page (e.g. Page 4), seamlessly rendering the preceding page with correct slice boundaries and updated footer count indicators (`Showing X-Y of Z questions`).

#### Pattern 5: Pure Logic Extraction for High-Coverage Testing
- **Challenge**:
  - Testing complex tabular multi-selection, state transforms, status counters, and modal flows inside full React component DOM trees requires heavyweight mounting libraries, slowing down CI pipelines and risking brittle render tests.
- **Architectural Solution**:
  - Extracted all deterministic state manipulation routines into pure, framework-agnostic helper functions in [`lib/portal/massActions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/portal/massActions.ts):
    - Selection management: `toggleSelectQuestion`, `toggleSelectPage`, `selectAllFiltered`, `clearSelection`, `isAllPageSelected`, `isSomePageSelected`.
    - Data transformations: `applyMassDelete`, `applyMassStatusUpdate`, `applyMassTopicUpdate`, `computeStatusCounts`.
    - Modal state management: `openMassActionModal`, `closeMassActionModal`, `executeModalConfirm`.
  - Allowed the automated verification suite ([`scripts/verify-mass-actions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-mass-actions.ts)) to execute 79 rigorous assertions across 6 functional suites in sub-second execution time (<40ms), guaranteeing 100% logic coverage without DOM overhead.

---

### 2. Verification & Production Deployment

- **Automated Verification Suite ([`scripts/verify-mass-actions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-mass-actions.ts))**:
  - **79/79 assertions passed (100%)** across 6 test suites:
    - Suite 1: Selection Logic & Set Transformations (14/14 passed).
    - Suite 2: Mass Delete & Pagination Boundary Clamping (14/14 passed).
    - Suite 3: Mass Status & Topic Mutation Transforms (12/12 passed).
    - Suite 4: Modal State Machine & Lifecycle Transitions (15/15 passed).
    - Suite 5: Dynamic Status Counters & Tab Synchronization (10/10 passed).
    - Suite 6: Component Contract & Neobrutalist UI Audit (14/14 passed).
- **TypeScript Type Safety**:
  - Strict type compilation check (`npx tsc --noEmit`) verified clean with 0 errors.
- **Production Git History**:
  - Atomic live push to `origin/main` (commit `8f1edad`): `feat(portal): add mass select, mass delete, status & topic actions with confirmation modal to question bank`.
  - Triggered successful Vercel CI/CD automated production redeployment.

## Reflection Log Entry - 2026-10-15 (Automated Agent Tooling Suite: Semantic Memory Engine, Worktree CLI, Headless UI Physics Verifier, & Shared Blackboard)

- **Date**: 2026-10-15
- **Topic**: Automated Agent Tooling Suite: Semantic Memory Engine, Worktree CLI, Headless Browser Physics Verifier, and Subagent Shared Blackboard State
- **Context & Objectives**:
  - The reflection log exceeded 1,300 lines (135+ KB), making manual or full-file inspection token-prohibitive for subagents seeking bug patterns and architectural rules.
  - Manual git worktree management (symlinking assets, timestamped branching, rebase, and ancestor checks) required multiple manual commands with risk of typo-induced desync.
  - TypeScript static analysis (`npx tsc`) could not catch browser runtime physics crashes (Framer Motion spring keyframe errors, flexbox badge wrapping, or unhandled promise rejections).
  - Parallel subagents lacked a lightweight, atomic shared state mechanism to coordinate active worktree paths, ports, and pipeline progress.

### 1. Architectural Solutions & Implemented Tooling Suite

#### A. Semantic Agent Memory Engine (`scripts/agent-memory.ts` / `npm run memory`)
- **Architecture**: Zero-dependency TypeScript AST/markdown parser structuring reflections into typed entries (`date`, `topic`, `keyInsights`, `architecturalSolutions`, `antiPatterns`, `verificationNotes`, `rulesAndTraps`).
- **Features**:
  - `search <query>`: Multi-term weighted scoring (+40 topic, +25 summary, +6 content, +20 multi-term bonus) with contextual excerpt extraction and term highlighting.
  - `recent [limit]`: Displays most recent N reflection entries with concise takeaways.
  - `rules`: Outputs categorized catalog of critical rules, bug traps, and code patterns.
  - `--json`: Exports structured JSON for automated ingestion by subagents.
- **Impact**: Enables subagents to retrieve exact bug pattern solutions in <200ms with zero token waste.

#### B. Worktree Automation CLI (`scripts/wt.ts` / `npm run wt`)
- **Architecture**: Production-grade CLI codifying Rule 12 into deterministic single-command lifecycles:
  - `create <topic>`: Derives repository root (`git rev-parse --show-toplevel`), generates collision-proof branch `feat/<topic>-$(date +%m%d%H%M)`, creates `.worktrees/<topic>` from `origin/main`, sets absolute symlinks (`node_modules`, `.env.local`), and isolates build caches.
  - `list`: Machine-parses porcelain worktree listings with paths, branches, and commit SHAs.
  - `verify [topic]`: Executes bundled verification (`npx tsc --noEmit` and `npm test`) inside the target worktree.
  - `release <topic>`: Rebases on `origin/main`, runs verification, shows log/diff, and executes atomic push `git push origin <branch>:main`.
  - `clean <topic>`: Verifies remote ancestor status (`git merge-base --is-ancestor`), safely removes worktree, and prunes local branch.

#### C. Headless Runtime Physics & UI Verifier (`scripts/verify-ui.ts` / `npm run test:ui`)
- **Architecture**: Automated browser test harness using `puppeteer-core` with macOS Chrome binary auto-resolution and launch flags (`--no-sandbox`, `--disable-gpu`, `--headless=new`).
- **Capabilities**:
  - Intercepts and flags `pageerror`, unhandled console errors, and unhandled promise rejections.
  - Specifically audits against Framer Motion's fatal 3-keyframe spring solver error (`Only two keyframes currently supported with spring`).
  - Programmatically asserts layout bounding boxes: desktop sidebar width $\ge 264$px and badge chip heights $\le 36$px to prevent flexbox wrapping.
  - Simulates interactive navigation (guest educator entrance and tab switching) ensuring clean DOM updates.
  - 17/17 automated assertions verified passing on production deployment (`https://revizz-sand.vercel.app`).

#### D. Subagent Shared State & Blackboard (`lib/agentBlackboard.ts`, `scripts/blackboard.ts` / `npm run blackboard`)
- **Architecture**: Lightweight state coordinator in `.agent/state/blackboard.json` with POSIX file-locking (`withFileLock` using exclusive file descriptor flags, stale lock recovery) and atomic write operations (`atomicWriteJson`).
- **Features**:
  - Manages `active_worktrees`, port allocations (`frontend`, `test_server`), `workers` status (`idle | running | completed | failed`), and `shared_data`.
  - Full CLI interface: `get`, `set <key> <val>`, `worker <id> <role> <status>`, `worktree`, and `reset`.

### 2. Verification & Package Integration
- Added npm script shortcuts to `package.json`: `"memory"`, `"wt"`, `"test:ui"`, `"blackboard"`.
- Clean TypeScript compilation across the repository (`npx tsc --noEmit` exit code 0).
- 10 core QA suites passing cleanly (`npm test` 56/56 assertions).


---

## Reflection Log Entry - 2026-10-15 (Question Bank Supabase Deletion Sync, Cascading Foreign Key Integrity & Row Action Isolation)

### 1. Context & Objectives
- **Problem**: When questions were deleted from the Question Bank table (either via mass selection or individual row action), they were previously only filtered from local React state (`setBankQuestions`). Upon page refresh or re-fetch from Supabase, the deleted questions reappeared.
- **Goal**: Implement an end-to-end atomic deletion pipeline that permanently deletes questions from the Supabase `questions` table, leverages Postgres `ON DELETE CASCADE` foreign keys for clean child records removal, invalidates runtime caches, and updates the UI defensively.

### 2. Architectural Solutions
- **Serverless Deletion Route (`app/api/questions/delete/route.ts`)**:
  - Implemented POST endpoint accepting `{ questionIds: string[] }`.
  - Added strict boundary validations: payload type checks, empty array rejection, batch limits (<= 500 items), and ID whitespace trimming.
  - Integrated `UUID_REGEX` filtering (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) to ensure non-UUID mock IDs never trigger PostgREST syntax errors.
  - Leverages Supabase service role key (falling back to anon key) to execute `supabase.from('questions').delete().in('id', uuidIds)`.
- **Database Helper & Runtime Cache Invalidation (`lib/questions.ts`)**:
  - Exported `deleteQuestionsFromDb(questionIds: string[])`.
  - Implemented dual-path execution: primary fetch to `/api/questions/delete` with seamless fallback to direct `supabase.from('questions').delete().in('id', uuidIds)`.
  - Prunes in-memory runtime cache `_cachedQuestions` synchronously to keep cross-component caches aligned.
- **Question Bank UI & Row Action Isolation (`components/portal/AdminTools.tsx`)**:
  - Added an **Action** column to the table header and an individual row delete button (`Trash2` icon) styled with tactile neobrutalist tokens.
  - Implemented `e.stopPropagation()` on row buttons to prevent unwanted drawer triggers (`onOpenEditor`).
  - Added `handleOpenDeleteSingle` to allow single-row deletions without clearing multi-selection sets.
  - Enhanced `handleConfirmMassAction` with optimistic state updates, pagination bounds clamping (`calculateClampedPage`), asynchronous Supabase deletion, background `refetchQuestions()`, and error recovery that restores questions if database deletion fails.
- **Suite 13 Test Alignment (`scripts/verify-revizz.ts`)**:
  - Aligned legacy StagingReview tests to inspect refactored modular components (`StagedPaperAuditor.tsx` and `StagedPapersQueue.tsx`), achieving 74/74 (100%) test passes.

### 3. Critical Rules & Anti-Patterns Learned
- **PostgREST UUID Trap**: Supabase/PostgREST throws a 400 error (`invalid input syntax for type uuid`) if non-UUID IDs (e.g. mock identifiers) are passed to `.in('id', ids)`. Always filter UUIDs using `UUID_REGEX` before querying UUID primary key columns.
- **Table Row Click Propagation Trap**: In interactive tables where rows have click handlers (e.g. opening an edit drawer), always call `e.stopPropagation()` on row-level action buttons (delete, edit, select) to prevent modal/drawer collision.
- **PostgreSQL Cascading Foreign Keys**: Always verify `information_schema.referential_constraints` before writing child cleanup code. In Revizz, `question_options`, `user_attempts`, and `review_pile` all have `delete_rule: "CASCADE"`, ensuring child records are automatically cleaned up in a single Postgres transaction.

---

## Reflection Log Entry - 2026-10-15 (Ingestion Studio Browser Draft Persistence, Validation Integrity & Phantom Banner Elimination)

- **Date**: 2026-10-15
- **Topic**: Ingestion Studio Browser Draft Persistence, Validation Integrity & Phantom Banner Elimination
- **Context & Objectives**:
  - Curators experienced persistent, unwanted "Saved Paper Draft Found in Browser" banners popping up repeatedly in the Cambridge Past Paper Ingestion Studio even when no active or valid draft existed.
  - The objective was to eliminate phantom draft prompts, enforce defensive client-side draft validation, auto-purge corrupted or stale storage records, synchronize draft state upon live Supabase publication, and introduce comprehensive regression tests.

### 1. Root Cause Analysis
1. **Blind Boolean LocalStorage Check**:
   - `hasDraft()` previously evaluated `Boolean(localStorage.getItem('revizz_ingestion_draft'))`.
   - String values such as `"null"`, empty objects `"{}"`, papers with 0 questions, or corrupted JSON strings evaluated to truthy, falsely declaring that a valid recoverable draft existed.
2. **Stale Published Papers Lingering in Storage**:
   - Successful Supabase upserts via `publishToSupabase` did not execute a draft clearance action.
   - Already-published papers lingered indefinitely in browser `localStorage`, continuing to trigger the "resume draft" notification on every visit.
3. **Unguarded Storage Persistence**:
   - `saveDraftToLocalStorage` lacked defensive state gating, persisting empty candidate papers with 0 questions and papers that had already entered the `published` lifecycle state.
4. **Duplicate Banner State Collision**:
   - `IngestionSetupWizard` rendered the resume banner even when `activePaper` was already active and being edited in memory, confusing curators by prompting them to resume sessions they were currently working on.
5. **Unreactive Mount-Only State Synchronization**:
   - `IngestionHub` only checked `hasDraft()` on initial component mount, failing to update reactive state when papers were loaded, edited, published, or cleared.

### 2. Architectural Patterns & Solutions

#### Pattern 1: Defensive Draft Schema Inspection & Self-Healing Purge (`lib/ingestion/useIngestionStore.ts`)
- **Strict Structural Parsing & Validation**:
  - `hasDraft()` safely parses JSON and accommodates both wrapped `{ paper: ... }` and raw `StagingPaper` structures.
  - Asserts non-empty questions: `Array.isArray(candidatePaper.questions) && candidatePaper.questions.length > 0`.
  - Asserts non-published lifecycle state: `candidatePaper.lifecycle_state !== 'published'`.
  - Runs formal Cambridge schema verification: `validateStagingPaper(candidatePaper, { allowPartialBatch: true })`.
- **Self-Healing Storage Invalidation**:
  - If parsing fails, or if candidate data has 0 questions, is corrupted, or represents an already-published paper, `hasDraft()` automatically executes `window.localStorage.removeItem(storageKey)` to self-heal and eliminate phantom banner recurrence.

#### Pattern 2: Guarded Persistence & Live Publication Cleanup (`lib/ingestion/useIngestionStore.ts`)
- **Persistence Guards**:
  - `saveDraftToLocalStorage` explicitly rejects persisting candidate papers with 0 questions or papers in `lifecycle_state === 'published'`.
- **Atomic Publication Draft Clearance**:
  - `publishToSupabase` invokes `actions.clearDraft()` immediately upon receiving a successful upsert receipt from Supabase, ensuring published work never leaves ghost artifacts in browser storage.

#### Pattern 3: Contextual Banner Gating & Reactive Synchronization (`components/ingestion/`)
- **Contextual Banner Gating (`IngestionSetupWizard.tsx`)**:
  - Gated the resume banner display on `!activePaper && hasSavedDraft`, ensuring recovery banners only appear when no active editing session is currently in memory.
- **Reactive State Synchronization (`IngestionHub.tsx`)**:
  - Synchronizes `hasSavedDraftState` reactively using `useEffect` with dependency array `[hasDraft, isSetupOpen, paper]`, reflecting immediate state changes across paper load, clear, and discard operations.

#### Pattern 4: Regression Test Harness (`scripts/verify-revizz.ts`)
- Implemented `[Suite 14] Ingestion Draft Persistence & Validation Integrity` covering 6 deterministic assertions:
  1. Empty storage returns `false`.
  2. Corrupted JSON strings are detected, return `false`, and are self-healed via `removeItem`.
  3. Empty paper objects or papers with 0 questions are purged and return `false`.
  4. Papers in `published` lifecycle state are purged and return `false`.
  5. Valid drafts with valid schema and questions pass validation and return `true`.
  6. Explicit draft clearance (`clearDraft()`) cleanly removes the key and updates store state.

### 3. Critical Rules & Anti-Patterns Learned
- **Blind LocalStorage Existence Trap**: Never rely on `Boolean(localStorage.getItem(key))`. Serialized storage strings like `"null"`, `"{}"`, or invalid formats are always truthy. Always parse JSON and validate schema contracts before concluding data presence.
- **Self-Healing Storage Pattern**: Don't simply return `false` on encountering corrupt or invalid storage data. Proactively call `localStorage.removeItem(key)` to self-heal client state and prevent recurring phantom UI prompts.
- **Post-Publish Storage Leak**: Always couple remote database mutations with local persistence cleanup. A successful publication must purge transient drafts to prevent ghost recovery prompts.
- **Active Editing Context Collision**: Gating draft recovery UI on `!activeSession` is essential to prevent confusing duplicate resume notifications during live authoring.

### 4. Verification & Production Deployment
- **Automated QA Test Suite**:
  - Executed `[Suite 14] Ingestion Draft Persistence & Validation Integrity` in `scripts/verify-revizz.ts`.
  - All 81/81 automated QA test assertions passing cleanly (100% test pass rate).
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` executed with 0 errors across the entire repository.
- **Production Git History**:
  - Feature branch: `feat/fix-draft-popup-10151336`
  - Atomic live push to `origin/main` (commit `fd133a0`).

---

## Reflection Log Entry - 2026-10-15 (Question Bank Zero-Fallback Data Layer Sync & Automated Staging Seeder Pipeline)

- **Date**: 2026-10-15
- **Topic**: Question Bank Zero-Fallback Data Layer Sync & Automated Staging Seeder Pipeline
- **Context & Objectives**:
  - The user noticed that although the Supabase `questions` database table was completely empty, the Question Bank table in `components/portal/AdminTools.tsx` rendered fake mock questions instead of displaying an empty state.
  - The objective was to eliminate all hardcoded mock fallbacks, establish zero-fallback reactive synchronization between the database layer and admin UI, deliver responsive empty/loading states, wire live telemetry indicators across the admin navigation and hub, provide an automated CLI seeder pipeline to publish verified Cambridge past papers into Supabase, and maintain complete regression test coverage.

### 1. Root Cause Analysis
1. **Mock Initial State Trap**:
   - `bankQuestions` state was initialized via `createInitialBankItems(CAMBRIDGE_QUESTIONS)`, seeding the component with hardcoded sample data on first render.
2. **Defective Synchronization Guard (`if (dbQuestions && dbQuestions.length > 0)`)**:
   - The synchronization `useEffect` strictly guarded on `if (dbQuestions && dbQuestions.length > 0)`.
   - When the database was empty (`dbQuestions.length === 0`), the condition evaluated to false, preventing `bankQuestions` from updating to `[]` and permanently leaving mock questions displayed on screen.
3. **Hardcoded Fallbacks in Assignment & Filter Options**:
   - `assignQs` fell back to `CAMBRIDGE_QUESTIONS` when `bankQuestions` was empty (`assignQs = bankQuestions.length > 0 ? bankQuestions : CAMBRIDGE_QUESTIONS`).
   - Topic dropdown options fell back to `CAMBRIDGE_TOPICS`, preventing the UI from reflecting genuine database taxonomy.
4. **Disconnected Admin Telemetry**:
   - Admin headers and hubs (`app/admin/page.tsx`, `components/admin/AppAdminHub.tsx`, `components/admin/AppAdminNav.tsx`) relied on static placeholders or decoupled metrics rather than reflecting real-time database question counts and database connection status.

### 2. Architectural Patterns & Solutions

#### Pattern 1: Zero-Fallback Reactive State Synchronization (`components/portal/AdminTools.tsx`)
- **Total Purge of Mock Datasets**:
  - Removed `CAMBRIDGE_QUESTIONS` and `CAMBRIDGE_TOPICS` from `AdminTools.tsx`.
  - Initialized `bankQuestions` to empty array `[]`.
- **Loading-Gated Zero-Fallback Sync**:
  - Replaced defective length check with loading-state gating:
    ```typescript
    useEffect(() => {
      if (!questionsLoading) {
        setBankQuestions(createInitialBankItems(dbQuestions || []));
      }
    }, [dbQuestions, questionsLoading]);
    ```
  - When `dbQuestions` is `[]`, `bankQuestions` cleanly synchronizes to `[]`, allowing empty states to render truthfully.

#### Pattern 2: Tactile Neobrutalist Loading & Empty States (`components/portal/AdminTools.tsx`)
- **Dynamic Loading Telemetry**:
  - Integrated animated loading state with tactile neobrutalist badge: `"Loading questions from database..."`.
- **Informative Empty State Banner**:
  - Implemented `"🗄️ Question Bank is Empty"` banner providing direct, actionable next steps: directing teachers/curators to the Ingestion Studio or running the CLI seeder (`npm run publish:staging`).

#### Pattern 3: Live Database Telemetry Across Admin Architecture
- **Admin Hub & Navigation Telemetry (`app/admin/page.tsx`, `components/admin/AppAdminHub.tsx`, `components/admin/AppAdminNav.tsx`)**:
  - Connected `useQuestions()` hook directly to admin pages.
  - Rendered live question counts, dynamic database connection status indicators (`● DB Connected`), and real-time badge counts.

#### Pattern 4: Automated Cambridge Staging Seeder Pipeline (`scripts/publish-staging-papers.ts`)
- **CLI Seeder with Dry-Run & Batch Support**:
  - Created automated TypeScript CLI seeder script `scripts/publish-staging-papers.ts` mapped to `npm run publish:staging`.
  - Supports `--dry-run` (validation and payload inspection without mutating database) and `--publish` flags.
  - Automatically loads and verifies all 20 staged Cambridge Economics past papers (600 verified questions across 2003–2024), mapping options, metadata, and diagrams into Supabase tables `papers`, `questions`, and `question_options`.

### 3. Critical Rules & Anti-Patterns Learned
- **"Empty Array Is a Valid State Trap"**: Never initialize state with mock fallback constants or write `if (data.length > 0) setState(data)`. When an empty database table is queried, `data.length === 0` is a valid, intentional state that must be propagated to render empty states. Guard on completion (`!loading`), not presence of elements (`data.length > 0`).
- **Eliminate Hardcoded UI Fallbacks**: Avoid fallback expressions like `items.length > 0 ? items : MOCK_ITEMS`. They mask database anomalies, mislead curators during development and production, and prevent testing true cold-start UX.
- **Admin Telemetry Consistency**: Always bind dashboard badges, navigation pills, and hub counters to authoritative data hooks (`useQuestions()`), ensuring system health and record counts are truthful across all admin viewports.

### 4. Verification & Production Deployment
- **Automated QA & Unit Test Suites**:
  - Executed 4 comprehensive test suites:
    1. Core verification harness: 81/81 unit assertions passing (`scripts/verify-revizz.ts`).
    2. Question Bank zero-fallback sync: 49/49 assertions passing.
    3. Empty database edge-case harness: 97/97 assertions passing.
    4. Automated staging seeder test harness: 33/33 assertions passing.
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` executed with 0 errors across the codebase.
- **Production Git History & Live Release**:
  - Feature branch: `feat/qbank-zero-fallback-sync`
  - Atomic live push to `origin/main` (commit `5bf8e45`).
  - Production deployment active and verified on Vercel: `https://revizz-sand.vercel.app`.
---

## Reflection Log Entry - 2026-10-15 (Paper Staging Teardown, Zero-Draft Contract Elimination, Direct Cambridge JSON Ingestion Pipeline & Live Question Bank Supabase Sync)

- **Date**: 2026-10-15
- **Topic**: Paper Staging Teardown, Zero-Draft Contract Elimination, Direct Cambridge JSON Ingestion Pipeline & Live Question Bank Supabase Sync
- **Context & Objectives**:
  - The legacy Ingestion Studio and Admin Portal maintained complex, multi-tiered paper staging queues (`staging/` filesystem scanning, intermediate staging review tabs, draft polling, and browser localStorage auto-saving) that introduced cognitive overhead and persistent synchronization issues.
  - Curators experienced phantom draft popups ("Saved Paper Draft Found in Browser"), stale staged paper queues, and disconnected Question Bank tables that relied on mocked client fallbacks rather than direct, real-time Supabase database state.
  - The objective of this architectural milestone was to completely tear down the intermediate paper staging layer, eradicate client-side browser draft persistence under a strict Zero-Draft Contract, introduce a direct 1-click Cambridge JSON ingestion pipeline in `IngestionSetupWizard`, and establish bidirectional live Supabase synchronization with dynamic filtering in `AdminTools.tsx`.

### 1. Architectural Solutions & Changes

#### 1. Removal of Paper Staging & Navigation Teardown
- **Route & Tab Normalization (`app/admin/page.tsx`)**:
  - Purged the `staged` navigation tab and all alias routes (`staging`, `staged-papers`).
  - Removed `'staged'` from valid admin tab collections and updated the demo admin mode banner to emphasize KaTeX diagnostics and Question Bank management.
- **Admin Hub & Navigation Streamlining (`components/admin/AppAdminNav.tsx`, `components/admin/AppAdminHub.tsx`)**:
  - Removed the `Staged Papers` button and `Layers` icon from `AppAdminNav.tsx`.
  - Replaced the legacy `Staged Papers` metrics card in `AppAdminHub.tsx` with a `Publish Pipeline` card (`Direct DB`, `Instant Publishing Active`).
  - Removed `case 'staged'` from the active tab switcher and redirected quick-action cards to the Question Bank.
- **Portal CMS Decoupling (`components/portal/AdminCMS.tsx`)**:
  - Removed the `📑 Staged Paper Review` tab trigger and view mode from `AdminCMS.tsx`.
- **Component Stubbing for Backward Compatibility (`components/portal/StagingReview.tsx`)**:
  - Replaced the 70-line `StagingReview` component hierarchy (`StagedPapersQueue`, `StagedPaperAuditor`) with a lightweight null stub export (`export default function StagingReview() { return null; }`) to maintain import compatibility with any remaining legacy references.

#### 2. Zero-Draft Contract & LocalStorage Elimination
- **Eradication of `revizz_ingestion_draft` Storage Key (`lib/ingestion/useIngestionStore.ts`)**:
  - Deprecated all client-side draft auto-persistence mechanisms.
  - `saveDraftToLocalStorage()` now explicitly removes `revizz_ingestion_draft` from `localStorage` and returns `false`.
  - `loadDraftFromLocalStorage()` returns `false` without attempting deserialization.
  - `hasDraft()` defensively executes `localStorage.removeItem(storageKey)` and returns `false`, ensuring zero phantom draft banners ever appear.
  - `clearDraft()` guarantees thorough cleanup of `LOCAL_STORAGE_KEY`.
- **Purge of Auto-Save Side Effects (`lib/ingestion/useIngestionStore.ts`)**:
  - Removed every automated `actions.saveDraftToLocalStorage()` call across extraction SSE chunks, completion callbacks, and error handlers.
  - Shifted default fallback `lifecycleState` from `'draft'` to `'review'`.
- **UI Header Cleanup (`components/portal/IngestionHeader.tsx`)**:
  - Removed the `Save Draft` action button, draft state props (`onSaveDraft`, `isDraftSaved`), and local bookmark feedback timers.
  - Relegated active header CTAs strictly to real-time utilities: KaTeX diagnostics, slide-over preview drawer, and direct Supabase publishing.

#### 3. Direct Cambridge JSON Ingestion Pipeline
- **Streamlined Setup Wizard Architecture (`components/portal/IngestionSetupWizard.tsx`)**:
  - Ripped out over 1,100 lines of complex staged paper queue polling, archive toggles, delete confirmations, and filesystem scanning.
  - Replaced with a focused, tactile `Direct Cambridge JSON Ingestion Pipeline` dropzone supporting drag-and-drop and native file selection for Cambridge past paper JSON files (`0455_s24_12.json`, etc.).
- **Pre-Flight Schema Validation**:
  - Automatically parses incoming JSON via `normalizeStagingPayload` and executes strict schema verification using `validateStagingPaper(candidate, { allowPartialBatch: true })`.
  - Instantly flags structural defects or missing fields with informative warning badges before touching the network.
- **Paper Summary Card**:
  - Upon successful parsing, renders a neobrutalist summary card detailing Syllabus Code (`0455`), Exam Series (`May/June`, `Oct/Nov`, `Feb/March`), Year, Paper Variant, Total Questions, Unique Topics, and Diagram count.
- **1-Click Supabase Push (`handleDirectPushToSupabase`)**:
  - Provides a single prominent `Push to Supabase 🚀` CTA that posts directly to `/api/ingest/publish`.
  - Receives live upsert receipts and displays success feedback with exact question counts imported into the database.

#### 4. Live Question Bank Table Sync & Dynamic Filtering
- **Authoritative Supabase Data Fetching (`components/portal/AdminTools.tsx`)**:
  - Integrated direct Supabase client queries via `supabase.from('questions').select(...)` joined across `papers`, `subjects`, `topics`, and `question_options`.
  - Added `fetchLiveQuestions()` with automatic invocation on component mount, post-ingestion push, and question deletion.
- **Dynamic Multi-Dimensional Filters**:
  - Dynamic derivation of Paper codes (e.g. `0455/12 M/J/24`), Exam Sessions (e.g. `May/June 2024`), Topics, Difficulty levels, and Statuses directly from live database records.
- **In-Place Curator Actions**:
  - Added `Upload JSON 🚀` button to the toolbar, allowing direct past paper ingestion without leaving the Question Bank view.
  - Added `Refresh 🔄` button invoking both `fetchLiveQuestions()` and `refetchQuestions()` for instant, zero-cache database polling.
  - Connected batch actions and single-item delete dialogs to execute atomic database deletions via `deleteQuestionsFromDb` with automated live table refresh.

#### 5. Worktree Isolation & Atomic Push Protocol
- **Dedicated Git Worktree**:
  - Isolated all refactoring, testing, and component modifications within worktree branch `feat/remove-paper-staging-10151738` branched strictly from `origin/main`.
- **Atomic Live Deployment**:
  - Verified static compilation (`npx tsc --noEmit`) and full test suite execution (84 assertions across 14 suites).
  - Pushed atomic commit `b701762` directly to `origin/main`.
  - Executed clean worktree teardown, leaving no dangling locks or untracked development artifacts.

### 2. Anti-Patterns & Traps Avoided

- **Phantom LocalStorage Draft Trap**: Storing transient serialized states in browser `localStorage` without aggressive expiration or strict lifecycle validation leads to phantom prompts that confuse curators. Enforcing a Zero-Draft Contract where valid Cambridge JSON files are either ingested immediately into Supabase or held in memory during curation eliminates phantom recovery states.
- **Defective Truthy Check on Storage Keys**: Relying on `Boolean(localStorage.getItem(key))` fails because strings like `"null"`, `"{}"`, or empty objects evaluate to truthy. Proactively removing keys on validation failure ensures self-healing client state.
- **Static Mocked Question Table Anti-Pattern**: Initializing admin tables with hardcoded fallback arrays (e.g. `CAMBRIDGE_QUESTIONS`) masks database anomalies and misleads curators. Direct database queries with reactive loading states ensure the admin interface truthfully represents Supabase storage.
- **Staging Queue Intermediate Bloat**: Maintaining an intermediate filesystem staging folder (`staging/`) that requires separate review tabs, audit queues, archive states, and secondary sync steps adds unnecessary steps. Direct JSON validation coupled with instant 1-click publishing streamlines the curation pipeline.

### 3. Verification & Test Results

- **Automated QA Test Suite (`scripts/verify-revizz.ts`)**:
  - All 84 assertions passed cleanly across 14 suites (100% pass rate):
    - Suite 1: Scoring & Streak Multipliers (8/8 passed)
    - Suite 2: Review Pile Queuing & Lifecycle (6/6 passed)
    - Suite 3: Topic Mastery Thresholds (4/4 passed)
    - Suite 4: Auth Display Name Sanitization (6/6 passed)
    - Suite 5: Timer Math & End-to-End Simulation (2/2 passed)
    - Suite 6: Portal Gate Security & Role Permissions (8/8 passed)
    - Suite 7: Question Compiler Search & Filtering Capabilities (6/6 passed)
    - Suite 8: Gemini Ingestion Model Migration & Normalization (10/10 passed)
    - Suite 9: Dynamic Resilience & Framer Motion Keyframe Integrity (3/3 passed)
    - Suite 10: Simplified Direct JSON Pipeline, Zero-Draft Contract & Supabase Bank (4/4 passed)
    - Suite 11: Ingestion Studio JSON Paper & Slice Upload Verification (8/8 passed)
    - Suite 12: Ingestion Studio Dropzone & Drag-and-Drop Resilience (6/6 passed)
    - Suite 13: Ingestion Pipeline Overhaul, Status Feedback & Supabase Upsert Receipts (6/6 passed)
    - Suite 14: Ingestion Draft Persistence & Validation Integrity (Zero-Draft Contract) (7/7 passed)
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` executed with 0 errors across the repository.
- **Production Git History**:
  - Feature branch: `feat/remove-paper-staging-10151738`
  - Atomic release commit: `b701762` on `origin/main` (`feat(ingestion): remove paper staging & drafts, simplify direct JSON upload, sync live Question Bank`).
---

## Reflection Log Entry - 2026-10-16 (Cambridge Ingestion Confirmation Receipt Redesign, Live Telemetry Synchronization & Atomic Worktree Release)

- **Date**: 2026-10-15 / 2026-10-16
- **Topic**: Cambridge Ingestion Confirmation Receipt Redesign, Live Telemetry Synchronization & Atomic Worktree Release
- **Context & Objectives**:
  - Overhauled the post-upsert confirmation modal ([IngestionPipelineModal.tsx](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPipelineModal.tsx)) from the legacy multi-step card layout to a high-fidelity tactile neobrutalist confirmation receipt matching pedagogical UX standards with 100% live telemetry data.
  - Eliminated all static mock fallbacks and assumed values, replaced rigid button structures with a unified 3-column responsive action grid, provided 1-click staging archive capabilities, and rendered real-time syllabus topic distribution pills directly from ingested question metadata.

### 1. Architectural Solutions & Changes

#### 1. Live Database Telemetry vs. Zero Mock Data Contract
- **Real Supabase Paper UUID & Clipboard Copy**:
  - The receipt surfaces authoritative Supabase paper UUIDs (`paperId`) with 1-click clipboard copy, displaying instant confirmation feedback (`Copied!`).
- **Dynamic Mutation Detection (`New Insert` vs. `Updated`)**:
  - Enhanced `/api/ingest/publish` ([route.ts](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/api/ingest/publish/route.ts)) to execute a pre-upsert check against `papers` by `subject_id`, `series`, `paper_code`, and `year`.
  - Determines whether the operation is a genuine `New Insert` or an `Updated` record, passing `is_new_insert` in the `PublishReceipt` payload to eliminate guesswork.
- **Accurate Question & Option Count Auditing**:
  - Displays dynamic question and option breakdown (`30 MCQs • 120 Options (4/Q)`), confirming that all multiple-choice choices are strictly mapped and accounted for.
- **Dynamic Media Asset & Verification Calculation**:
  - Analyzes the paper questions dynamically to compute:
    - Extracted Diagrams: detects image assets referenced in question metadata.
    - Markdown Tables: evaluated via table regex pattern (`/\|[\s-:]*\|/`).
    - Answer Key Verification: verifies single-correct answer keys (`✓ 30/30 Keys Verified`).

#### 2. Dynamic Syllabus Units Mapping & Topic Pills
- **Topic Distribution Derived from Questions**:
  - Aggregates questions by their assigned syllabus unit/topic directly from the paper question payload.
  - Dynamically calculates the number of units mapped (`SYLLABUS TOPICS MAPPED (X UNITS)`).
- **Clean Topic Abbreviations & Counts**:
  - Groups questions into pedagogical unit buckets with clean abbreviations, such as:
    - `1. Basic Econ (3)`
    - `2. Allocation of Resources (8)`
    - `3. Micro (6)`
    - `4. Government & Macro (6)`
    - `5. Development (3)`
    - `6. Int'l Trade (4)`
  - Rendered as tactile neobrutalist pills (`bg-[#eae4d8] text-[#201e1d] rounded-lg text-xs font-semibold`).

#### 3. Neobrutalist Design System Alignment
- **Tactile Banner Aesthetics**:
  - Styled with a soft sage green banner (`bg-[#dcead8]`, `border-2 border-[#1f2937]`, `shadow-[4px_4px_0_#1f2937]`) paired with a deep forest checkmark badge (`bg-[#1c4427] text-white`).
- **Integrated Staged JSON Archive Action**:
  - Surfaces a 1-click archiving utility (`🗄️ Archive Staged JSON File`) directly inside the receipt modal when ingesting staged Cambridge papers, automatically relocating source files to `staging/archive/`.
- **Responsive 3-Column Footer Actions**:
  - Standardized bottom action bar into a tactile, responsive 3-column button grid:
    1. `+ Upload Another Paper` (white neobrutalist button resetting modal state for batch curation).
    2. `← Done / Return Workspace` (white neobrutalist button closing modal and returning to editor).
    3. `View in Question Bank ↗` (deep moss green action button `bg-[#5f6e49]` redirecting to Question Bank with paper filter active).

#### 4. Worktree Lifecycle & Multi-Agent Governance (Rule 12 Compliance)
- **Worktree Isolation**:
  - Created isolated worktree branch via `npm run wt -- create feat/ingest-receipt-modal` strictly from `origin/main`.
  - Linked shared `node_modules` and environment variables.
- **Bundled Verification**:
  - Subagents implemented and self-verified changes locally, running `npx tsc --noEmit` and the automated test suite (84/84 passing assertions across 14 suites).
- **Atomic Live Push**:
  - Rebased and released cleanly via `npm run wt -- release feat/ingest-receipt-modal`, pushing commit `55143bc` atomically to `origin:main`.
  - Executed worktree cleanup via `npm run wt -- clean feat/ingest-receipt-modal`, leaving zero dangling artifacts.

### 2. Anti-Patterns & Traps Avoided

- **Hardcoded Receipt Mock Data Anti-Pattern**: Rendering static placeholder values (e.g. "30 Questions", "120 Options", assumed success badges) on confirmation dialogs creates a false sense of security and obscures database upsert failures. Guaranteeing that every counter, UUID, and status badge reflects the live API response receipt ensures complete data integrity.
- **Pre-Upsert Ambiguity Trap**: Blindly running upserts without checking for existing records makes it impossible for curators to distinguish between new additions and accidental overwrites of existing past papers. Pre-querying the database provides unambiguous `New Insert` vs `Updated` telemetry.
- **Button Clutter & Navigation Dead-Ends**: Fragmented or hidden navigation actions after publishing leave curators stranded. Providing clear, tactile next-step pathways (`Upload Another`, `Return Workspace`, `View in Question Bank`) preserves high workflow velocity.

### 3. Verification & Production Deployment

- **Automated QA Test Suite (`scripts/verify-revizz.ts`)**:
  - 84/84 automated test assertions passed cleanly across all 14 test suites (100% pass rate).
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` completed with 0 errors across the codebase.
- **Production Git History**:
  - Feature branch: `feat/ingest-receipt-modal`
  - Atomic release commit: `55143bc` on `origin/main` (`feat(ingestion): redesign confirmation receipt modal with live Supabase telemetry`).
---

## Reflection Log Entry - 2026-10-16 (Argon Master Orchestrator & Mandatory Dual-Flash Subagent Concurrency Architecture)

- **Date**: 2026-10-16
- **Topic**: Argon Master Orchestrator & Mandatory Dual-Flash Subagent Concurrency Architecture
- **Context & Objectives**:
  - Overhaul multi-agent orchestration architecture to eliminate cold-start discovery lag, redundant planning subagent hops, and single-subagent bottlenecks.
  - Implement the **Argon Master (`pro`) + All-Flash Subagent Fleet (`flash` / `flash_lite`)** division of labor: executing deep architectural decomposition, blueprint synthesis, and diff auditing natively in the Argon root orchestrator while delegating all discovery, coding, testing, and memory updates to agile, high-velocity Flash subagents.
  - Enforce the **Mandatory 2-Subagent Minimum Concurrency Rule (Rule 3)** across all development tasks, establishing three canonical parallelization patterns (Builder + QA Pipelining, Disjoint File Partitioning, and Multi-Angle Diagnostic Fleet).
  - Consolidate all system rules, templates, CLI tooling (`npm run wt`, `npm run memory`, `npm run test:ui`, `npm run blackboard`), Dual Operational Modes (Feature Engineering vs Past Paper Ingestion), and Revizz architectural guardrails into a single self-contained, universal bootstrapping prompt.

### 1. Architectural Solutions & Paradigm Shifts

#### 1. Argon Master Orchestrator & All-Flash Fleet Division of Labor
- **Root Orchestration Tier (Argon / `pro`)**:
  - Eliminates the anti-pattern of spawning a separate "Planner" subagent. The Argon orchestrator directly conducts codebase exploration, problem formulation, task tree decomposition, git worktree isolation, and post-implementation diff auditing.
  - Adheres strictly to the **Strict No-Coding Constraint**: The master orchestrator NEVER directly modifies code files under any circumstances, preserving its high-level reasoning bandwidth and full global perspective.
- **Subagent Fleet Execution Tier (Flash / `flash` & `flash_lite`)**:
  - Subagents are exclusively deployed on Flash-tier models (`flash` / `flash_lite`), unlocking near-instant invocation, maximum execution velocity, rapid compiler feedback loops, and dramatic context token efficiency.
  - Subagents carry bundled verification responsibilities (`npx tsc --noEmit` and targeted validation) before signaling completion.

#### 2. Mandatory 2-Subagent Minimum Concurrency (Rule 3)
- Under no circumstances is a solitary subagent dispatched for an implementation or audit task. Every task dispatches a minimum of two concurrent subagents according to one of three architectural archetypes:
  1. **Builder + QA Pipelining**:
     - *Subagent A (Implementation / Builder)*: Executes core file modifications, UI refactoring, or API logic changes.
     - *Subagent B (QA Verifier / Test Scaffolder)*: Concurrently authors test fixtures, assertions (`scripts/verify-revizz.ts`), and runs compiler/test validations against the shared worktree state.
  2. **Disjoint File Partitioning**:
     - Concurrently divides work across independent architectural domains (e.g., Subagent A handles Frontend UI/components while Subagent B refactors Backend API routes / database services / state management).
     - Strict non-overlapping file ownership prevents edit collisions and git merge conflicts.
  3. **Multi-Angle Diagnostic Fleet**:
     - When debugging or conducting audits, dispatches complementary analytical perspectives concurrently (e.g., Subagent A: AST/Code Path Tracer examining call stacks and type definitions; Subagent B: Memory & Log Inspector auditing reflection history, Supabase telemetry, and runtime error traces).

#### 3. Single-Prompt Self-Contained Bootstrapping
- Unified all orchestration rules, operational constraints, and workflow protocols into a comprehensive root system contract:
  - **Tooling Suite CLI Integration**: Native commands for `npm run wt` (git worktree isolation & release), `npm run memory` (reflection indexer & rule lookup), `npm run test:ui` (headless Puppeteer physics & spring audit), and `npm run blackboard` (cross-agent shared whiteboard).
  - **Dual Operational Modes**: Explicit branching contracts between *Feature Engineering Mode* (strict worktrees, component isolation, Framer Motion springs, KaTeX defense) and *Past Paper Ingestion Mode* (zero-draft direct JSON upload, Supabase bank sync, 30 vs 40 MCQ validation, live confirmation receipts).
  - **Zero-Polling & Passive Turn-Ending**: Strict enforcement of passive turn termination. Dispatches parallel subagents or background tasks and immediately yields turns without polling `manage_subagents(list)` or `manage_task(status)`.

### 2. Anti-Patterns & Traps Avoided

- **The Solitary Subagent Bottleneck**: Spawning a single subagent creates a serial bottleneck where implementation, testing, and reflection happen sequentially, doubling cycle times and risking unchecked confirmation bias. Dual concurrency enforces separation of concerns and immediate verification parity.
- **Redundant Planning Subagent Indirection**: Delegating planning to a child subagent introduces unnecessary turn latency (15–30s), burns 20k+ tokens duplicating parent context, and separates planning context from git orchestration. Root Argon execution keeps orchestration immediate and authoritative.
- **Unverified Handoff Hazard**: Handing off code without verification causes downstream failures. Subagents self-compile and execute targeted assertions within their execution cycle prior to reporting back.
- **Polling Loop Token Exhaustion**: Repetitive status checks waste agent budget. Antigravity's reactive wakeup mechanism resumes execution when subagent tasks resolve.

### 3. Verification & Operational Governance

- **CLI Tooling Parity**:
  - `npm run memory -- recent 20` and `npm run memory -- rules` verified operational and fully synchronized with `.agent/memory/learnings_and_reflections.md`.
  - Memory indexing covers 40 reflection entries across 14 consolidated rules, 160+ key insights, and 75+ architectural solutions.
- **Rule Alignment**:
  - System rules in `AGENTS.md` and memory indexes updated to codify the Argon Master + Flash Fleet architecture and Mandatory Dual-Subagent Minimum.

---

## Reflection Log Entry - 2026-10-16 (Zero-Discovery Codebase Atlas Indexer, Race-Free Dual-Subagent Synchronization, & Plain-English Closing Contract)

- **Date**: 2026-10-16
- **Topic**: Zero-Discovery Codebase Atlas Indexer, Race-Free Dual-Subagent Synchronization, & Plain-English Closing Contract
- **Context & Objectives**:
  - Eliminate redundant codebase exploration overhead where subagents execute blind search loops (`grep_search`, `find_by_name`, exploratory file views) consuming 50k+ tokens and multiple roundtrips per session.
  - Implement a 3-layer architecture for instantaneous zero-discovery navigation: Codebase Atlas indexing (`npm run map` / `.agent/CODEBASE_MAP.md`), Master-orchestrator coordinate injection (`L<start>-L<end>`), and warm subagent reuse (`send_message`).
  - Establish race-free concurrency guardrails for multi-subagent execution: strictly disjoint file partitioning, last-finisher verification orchestration, and single-committer git index locking (`.git/index.lock`).
  - Formalize the user-facing closing protocol: requiring every master orchestrator completion to conclude with a plain-English 2–4 sentence summary and exactly 3 numbered next steps.

### 1. Architectural Solutions & Paradigm Shifts

#### 1. 3-Layer Zero-Discovery Architecture
- **Layer 1: Static Codebase Atlas (`npm run map` / `.agent/CODEBASE_MAP.md`)**:
  - The AST and structural symbol indexer (`scripts/codebase-map.ts`) parses the entire repository (components, lib, scripts, styles, types) to produce `.agent/CODEBASE_MAP.md` and `.agent/state/codebase-map.json`.
  - Every exported symbol, function, component, interface, and CLI entry point is mapped with exact line ranges (`L<start>-L<end>`), file paths, and dependency graphs.
  - Integrated into `scripts/wt.ts verify`: whenever a worktree or feature is verified, the codebase atlas automatically regenerates quietly, keeping the architectural map perpetually up to date.
- **Layer 2: Master Coordinate Injection (Zero Blind Searches)**:
  - On Turn 1 of any task, the Master Agent inspects the Codebase Atlas (or runs `npm run map -- query <symbol>`) to extract target paths and precise slice coordinates.
  - The Master Agent injects these coordinates directly into subagent dispatch prompts. Subagents bypass all discovery phases and execute tight, targeted edits immediately.
- **Layer 3: Warm Subagent Reuse (`send_message`)**:
  - Instead of discarding subagents after single file edits and incurring fresh cold-start context loads, master orchestrators communicate with active subagents via `send_message(Recipient=conversationId)`.
  - Warm subagents retain already-read file contents and TypeScript project structures in active working memory, slashing token consumption on follow-up tasks.

#### 2. Race-Free Dual-Subagent Synchronization
- **Strictly Disjoint File Partitioning**:
  - Under the Mandatory 2-Subagent Minimum (Rule 3), tasks are divided into mutually exclusive file ownership sets (e.g. Subagent A modifies `scripts/codebase-map.ts` while Subagent B modifies `package.json`, `scripts/wt.ts`, `AGENTS.md`, and memory reflections).
  - Subagents are strictly prohibited from touching the other subagent's assigned files, entirely eliminating file write collisions and merge conflicts.
- **Last-Finisher Verification**:
  - Static typechecking (`npx tsc --noEmit`) and integration test suites (`npm test`) are executed at the milestone boundary after disjoint edits are written, ensuring end-to-end repository cohesion.
- **Single-Committer Git Lock Prevention (`.git/index.lock`)**:
  - Concurrent subagents never run parallel `git commit` commands, preventing `.git/index.lock` collisions. Git staging and commits are managed sequentially or exclusively by the master orchestrator.

#### 3. Plain-English User-Facing Closing Contract (Rule 14)
- Codified standard closing protocol: every master response to the user must end with:
  - `### Simple Summary of What Was Done`: 2–4 plain-English, non-technical sentences explaining the tangible outcome and user benefit.
  - `### 3 Suggested Next Steps`: Exactly three numbered, concrete next steps guiding testing, verification, or subsequent roadmap items.

### 2. Anti-Patterns & Traps Avoided

- **Blind Codebase Grep Traps**: Costly turns spent grep-searching for component usages and reading 500-line files to find a single helper function. The Codebase Atlas provides instant, pre-computed symbol coordinates.
- **Concurrent Git Index Lock Contention**: Two parallel subagents running `git commit` simultaneously throws `fatal: Unable to create '.git/index.lock': File exists`. Delegating git commits to a single coordinator eliminates lock contention.
- **Overlapping File Clobbering**: Parallel subagents modifying shared files lead to lost edits and inconsistent ASTs. Disjoint file partitioning guarantees deterministic concurrency.
- **Technical Jargon Overload in Handoffs**: Overwhelming users with raw tool output and internal mechanics. The Rule 14 closing contract ensures clarity, accessibility, and actionable next steps.

### 3. Verification & System Integration

- **TypeScript Static Verification**: `npx tsc --noEmit` verified 0 errors across the repository.
- **Test Suite Pass**: `npm test` passed 100% across all assertions.
- **Automation CLI Integration**:
  - `package.json` contains `"map": "tsx scripts/codebase-map.ts"`.
  - `scripts/wt.ts verify` auto-syncs the atlas quietly upon verification completion.
  - `AGENTS.md` updated with Rule 3 enhancements, Rule 13, and Rule 14.

---

## Reflection Log Entry - 2026-10-16 (Cambridge Mark Scheme Checker & Auto-Remediator, React Error #310 Modal Hook Remediation, & Headless Live Production Verification)

- **Date**: 2026-10-16
- **Topic**: Cambridge Mark Scheme Checker & Auto-Remediator, React Error #310 Modal Hook Remediation, & Headless Live Production Verification
- **Context & Objectives**:
  - **100% Mark Scheme Parity**: Cambridge Economics past paper questions must align with 100% fidelity to official Cambridge International Education (CIE) Mark Schemes (`_ms_` PDF answer keys). Even a single inverted answer key or mismatched distractor degrades student trust and invalidates mastery telemetry.
  - **Comprehensive Developer CLI & Studio UI**: Build dual-surface verification tools: a fast, automated developer CLI (`npm run check:ms`) for batch audits across all local staging JSON files, and an intuitive, interactive Ingestion Studio UI ("Verify MS" action pill and neobrutalist modal) for real-time validation during paper ingestion.
  - **Eliminate React Error #310**: Investigate and permanently remediate runtime React Minified Error #310 crashes observed when opening conditional modals in the Ingestion Studio.
  - **Headless Live Production Verification**: Validate end-to-end functionality, UI state transitions, and auto-remediation against the deployed production app (`https://revizz-sand.vercel.app`) using automated headless Puppeteer browser testing.

### 1. Architectural Solutions & Paradigm Shifts

#### 1. Hybrid Mark Scheme Parsing Engine
- **PyMuPDF Python Extractor (`scripts/parse_mark_scheme.py`)**:
  - High-performance, layout-aware vector text extraction capable of handling both modern single-column table formats (`Question`, `Key`, `Marks`, e.g., `1 D 1`) and legacy multi-column grid layouts (e.g., questions 1–15 in column 1 and 16–30 in column 2: `1 A 16 C`).
  - Employs regex pattern matching across block and tabular layouts with robust normalization, stripping Cambridge footers, disclaimers, and syllabus codes.
- **Pure TypeScript Fallback Parser (`lib/ingestion/markSchemeParser.ts`)**:
  - Zero-dependency client/server parser designed for copy-pasted text from PDF viewers, clipboards, or raw OCR text streams.
  - Extracts question-to-answer mappings (`Map<number, 'A' | 'B' | 'C' | 'D'>`) with boundary checks and validation against expected 30-question (IGCSE) or 40-question (A-Level) paper lengths.

#### 2. Atomic Auto-Remediation Engine (`lib/ingestion/markSchemeRemediator.ts`)
- **Holistic Parity Realignment**:
  - When an ingested question answer disagrees with the official mark scheme key, auto-remediation executes an atomic 3-way synchronization:
    1. **`is_correct` Flag Inversion**: Realigns option flags so exactly one option matching the official mark scheme key has `is_correct: true` while all others are set to `false`.
    2. **Distractor Analysis Prefix Re-tagging**: Swaps the distractor reasoning headers so the newly correct option receives `"Correct - ..."` and previously marked options receive `"Incorrect - ..."`.
    3. **Explanation Markdown Conclusion Rewriting**: Scans the concluding derivation sentence in `explanation_markdown` (e.g., *"Therefore, the correct answer is C."*) and updates it to reflect the verified key.
- **KaTeX Formula & Currency Amount Defense**:
  - Mathematical equations and financial quantities in explanations often contain dollar symbols and single characters (e.g., `\$12,000`, `\$450`, or `$Q_D = 100 - 2P$`).
  - Utilizes strict negative lookbehind and lookahead regex assertions (`(?<!\\)\$([^\$]+)\$`, `(?<![a-zA-Z0-9])([A-D])(?![a-zA-Z0-9])`) to ensure formula tokens, math variables, and currency amounts are never accidentally overwritten during letter replacements.

#### 3. Ingestion Studio Web UI Integration
- **Docked Header Action Pill (`components/portal/IngestionHeader.tsx`)**:
  - Adds a dynamic `Verify MS` action pill to the docked Ingestion Studio topbar.
  - Features real-time status badges:
    - `unverified` (default slate pill): Prompting user to verify against official answer key.
    - `mismatches_found` (amber/coral alert pill with count badge): Indicating detected key conflicts.
    - `perfect_match` (emerald verified pill with checkmark): Confirming 100% alignment across all questions.
- **Interactive Verification & Diff Modal (`components/portal/IngestionMarkSchemeModal.tsx`)**:
  - Built with Revizz's 3D neobrutalist aesthetic (`border-2 border-[#2b2b2b] shadow-[6px_6px_0px_#2b2b2b]`).
  - Supports dual input modes: auto-loading matching mark scheme files from disk / server, or direct clipboard pasting of raw mark scheme text.
  - Displays side-by-side mismatch diff cards showing Question Number, Ingested Key vs Mark Scheme Key, and impacted distractor text.
  - Provides a single-click `"Auto-Fix All Mismatches"` button that executes in-memory remediation with instantaneous reactive re-rendering.

#### 4. Backend Serverless API (`app/api/ingest/verify-ms/route.ts`)
- Next.js App Router endpoint supporting multiple verification payloads:
  - Validates in-memory JSON paper payloads against disk-based mark schemes.
  - Accepts raw pasted mark scheme text strings for server-side parsing.
  - Handles multipart PDF uploads for serverless PyMuPDF / TypeScript extraction.
  - Returns structured verification receipts: `{ total, matched, mismatches: [{ questionNumber, ingestedKey, markSchemeKey, questionText }], accuracyPercentage }`.

### 2. Anti-Patterns & Critical Traps Avoided

- **React Error #310 (Hook Ordering Violation in Conditional Modals)**:
  - *The Trap*: In `IngestionPipelineModal.tsx`, an early exit guard was positioned before several memoized computation hooks:
    ```tsx
    // ANTI-PATTERN: Early return before hook declarations
    if (!open) return null;
    const computedSteps = useMemo(() => ..., [...]);
    const activeProgress = useMemo(() => ..., [...]);
    ```
    When the modal rendered closed (`open = false`), React recorded 0 hook invocations for that block. When the modal opened (`open = true`), React executed 7 additional `useMemo` hooks, triggering **Minified React Error #310 ("Rendered more hooks than during the previous render")** and crashing the UI tree.
  - *The Rule*: **All React hooks (`useState`, `useMemo`, `useCallback`, `useEffect`, `useRef`) must ALWAYS be called unconditionally at the top of the component function.** Any conditional rendering gates (`if (!open) return null;`) must be placed strictly after all hook declarations, immediately before the JSX return.
- **Cross-Worktree Path Traversal Failures**:
  - *The Trap*: Scripts running inside isolated git worktrees (`.worktrees/feat-.../`) defaulted to `path.join(process.cwd(), 'Economics (0455)')`, which failed because the historical past paper archive resides in the repository root two levels up.
  - *The Fix*: Implemented hierarchical path resolution checking `process.cwd()`, `path.resolve(process.cwd(), '../..')`, and environment fallbacks, guaranteeing seamless file resolution across both main repository checkouts and isolated worktrees.
- **Shallow Ingestion Parity (Key-Only Inversion)**:
  - *The Trap*: Changing only `is_correct: true` on an option without updating distractor text creates contradictory content where the correct answer claims "Incorrect - because..." and the explanation concludes with a different letter.
  - *The Fix*: Atomic 3-way remediation synchronizes option flags, distractor prefixes, and conclusion derivations simultaneously.

### 3. Verification & Live Evidence

- **Automated Mark Scheme Verification Test Suite (`scripts/verify-ms-checker.ts`)**:
  - Ran 6 comprehensive test scenarios covering modern single-column tables, legacy multi-column tables, copy-paste text parsing, mismatch detection, auto-remediation parity, and KaTeX formula preservation:
    - Test 1: Modern single-column MS parsing -> **PASS**
    - Test 2: Legacy multi-column MS parsing -> **PASS**
    - Test 3: Raw pasted text parsing -> **PASS**
    - Test 4: Mismatch detection & diff computation -> **PASS**
    - Test 5: Atomic auto-remediation parity -> **PASS**
    - Test 6: Formula & currency token protection -> **PASS**
  - Result: **6/6 passed (100%)**.
- **Core Repository QA Suite**:
  - Full Jest/Vitest test suite: **84/84 tests passed across 5 test suites**.
  - TypeScript static typecheck: `npx tsc --noEmit` passed with 0 compilation errors.
- **Full Staging Batch Audit (600 Questions across 20 Papers)**:
  - Evaluated 20 staging JSON papers (0455 Series from 2020–2024, 600 total MCQs) against official Cambridge Mark Schemes.
  - Uncovered 1 real-world distractor discrepancy in `0455_s24_12.json` (Question 18 key had mismatched distractor reasoning).
  - Successfully auto-remediated `0455_s24_12.json` to 100% parity (30/30 verified).
- **Headless Live Production Browser Verification**:
  - Dispatched an automated Puppeteer test script targeting the live production deployment (`https://revizz-sand.vercel.app/admin?tab=ingestion`).
  - Verified:
    1. Navigation to Ingestion Studio and rendered state of `Verify MS` header pill.
    2. Modal opening without React Error #310 or console warnings.
    3. Simulated mark scheme text input and diff calculation.
    4. Auto-remediation trigger and reactive state update to "All 30 Questions Verified (100% Match)".
  - Result: Production verified fully functional in live browser environment.

## Reflection Log Entry - 2026-10-16 (Teacher Portal Navigation Configuration, Real-Time Tab Broadcasting & Admin Menu Manager)

- **Date**: 2026-10-16
- **Feature**: Dynamic Teacher Portal Menu Manager & Navigation Customization
- **Summary**:
  Engineered full-lifecycle navigation management for the Teacher Educator Portal directly from the App Admin Command Deck (`/admin?tab=portal-menu`), featuring:
  - Telemetry badges displaying active, hidden, total, and custom link counts.
  - Granular active/hidden toggles for all standard core modules (`overview`, `roster`, `assign`, `compiler`, `mastery`, `xp`, `bank`, `flagged`, `school`).
  - An accessible custom item creator modal supporting display titles, external/internal URLs, section grouping, and icon selection (`ExternalLink`, `Link`, `BookOpen`, `FileText`, `Sparkles`, `Building2`).
  - Safe deletion of custom links with protection preventing accidental deletion of standard core modules.
  - Reset to factory defaults with confirmation prompt.
  - Seamless real-time in-app synchronization (`CustomEvent('revizz_portal_nav_changed')`) updating the Teacher Portal sidebar instantaneously without page reloads.

### 1. Key Architectural Patterns

#### Pattern 1: Real-Time In-App Event Broadcasting & LocalStorage Persistence
- **Challenge**:
  - Updating navigation preferences in the App Admin Deck must instantly reflect in the Teacher Portal sidebar without requiring a hard browser refresh or page navigation.
- **Architectural Solution**:
  - Implemented `lib/portal/menuConfig.ts` with dual storage and event broadcasting:
    ```typescript
    window.localStorage.setItem(PORTAL_NAV_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(PORTAL_NAV_CHANGE_EVENT, { detail: items }));
    ```
  - Both `PortalMenuManager.tsx` and `AdminNav.tsx` subscribe to `PORTAL_NAV_CHANGE_EVENT` in `useEffect`, providing instantaneous reactive UI re-rendering when modules are toggled, added, or deleted.

#### Pattern 2: SSR Hydration Safety & Defensive Fallbacks
- **Challenge**:
  - Next.js server-side rendering has no access to `window.localStorage`. Accessing storage during server render or initial client hydration triggers server-client markup divergence and React hydration errors.
- **Architectural Solution**:
  - Guarded all storage operations with `typeof window !== 'undefined' && window.localStorage`.
  - In `PortalMenuManager.tsx`, utilized a `mounted` state gate (`const [mounted, setMounted] = useState(false)`) rendering a lightweight skeleton placeholder until client-side hydration completes.
  - In `AdminNav.tsx`, initialized `navConfig` to `[]` and defaulted `isEnabled` to `true` during SSR, ensuring server and initial client renders match exactly before applying local storage overrides.

#### Pattern 3: Worktree Isolation & Atomic Production Release
- **Pattern**:
  - Feature developed and tested exclusively inside `.worktrees/portal-menu-manager` on branch `feat/portal-menu-manager-10162232`.
  - Rebased cleanly on `origin/main` and pushed directly via refspec (`git push origin feat/portal-menu-manager-10162232:main`), deploying commit `7d5b53a` to Vercel production without risking unverified root directory changes.
  - Verified live on production (`https://revizz-sand.vercel.app/admin?tab=portal-menu&guest=true`) with headless browser tests, and safely cleaned up worktree and branch.

### 2. Verification & Live Evidence
- **Automated Test Suite ([`scripts/verify-revizz.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-revizz.ts))**:
  - 101/101 tests passed across 15 test suites, including all 17 dedicated Suite 15 tests.
- **TypeScript Static Check**:
  - `npx tsc --noEmit` passed with 0 compilation errors.
- **Production Verification**:
  - Headless Chromium validated live deployment at `https://revizz-sand.vercel.app/admin?tab=portal-menu&guest=true` (HTTP 200, DOM elements mounted).


## Session Reflection: Ingestion Studio UI Optimization, Power-Tool Wiring & Curation Ergonomics (2026-10-16)

### Overview
This session focused on transforming the Cambridge Exam Ingestion Studio into a production-grade, spacious, and ergonomic power curation environment for teachers and curriculum directors. We resolved critical dual-pane layout cramping, mounted dormant high-value studio overlays, eliminated a subtle React state contamination bug on question navigation, and established clean worktree staging practices.

### 1. Key Architectural Learnings & Bug Patterns

#### Pattern 1: Eliminating Triple-Nested Layout Cramping
- **Challenge**:
  - [`app/admin/page.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/admin/page.tsx) capped its `<main>` container at `max-w-7xl` with `p-8`. Inside this container, [`IngestionHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHub.tsx) and [`IngestionStudioFrame.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionStudioFrame.tsx) introduced two additional layers of `p-8` padding.
  - This nested constraint squeezed the dual-pane PDF viewer + question curation editor down to ~950px of effective horizontal space, causing severe horizontal scrollbars, clipped text areas, and poor curation ergonomics on desktop monitors.
- **Architectural Solution**:
  - Dynamically widened the admin shell container in [`app/admin/page.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/admin/page.tsx) to `max-w-[1800px]` whenever `activeTab === 'ingestion'`.
  - Stripped redundant padding layers from child frames in [`IngestionHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHub.tsx) and [`IngestionStudioFrame.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionStudioFrame.tsx), recovering ~520px of horizontal workspace for the dual-pane workspace.

#### Pattern 2: Connecting Dormant Studio Overlays
- **Challenge**:
  - Three high-value diagnostic and simulator tools existed fully implemented in `components/portal/` and wired to state in [`lib/portal/useIngestionStore.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/portal/useIngestionStore.ts):
    1. [`IngestionPreviewModal.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPreviewModal.tsx) (Live Student Gameboy Simulator)
    2. [`IngestionAuditDrawer.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionAuditDrawer.tsx) (7-Point Quality Gate & Schema Audit)
    3. [`IngestionPayloadModal.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionPayloadModal.tsx) (Raw Ingestion JSON & Idempotent Postgres SQL Generator)
  - However, none of these components were mounted in the root render tree of [`IngestionHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHub.tsx), leaving them dormant and inaccessible.
- **Architectural Solution**:
  - Mounted `IngestionPreviewModal`, `IngestionAuditDrawer`, and `IngestionPayloadModal` at the root of [`IngestionHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHub.tsx).
  - Wired 1-click tactile action buttons (`Preview` and `Audit`) into [`IngestionHeader.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionHeader.tsx), seamlessly triggering the simulator modal and audit drawer via Zustand actions.

#### Pattern 3: React State Sync Spread-Order Bug Pattern (`IngestionOptionsEditor.tsx`)
- **Challenge**:
  - When syncing incoming question props (`distractorAnalysis`) into local component state (`localDistractorMap`) inside a `useEffect` across question index transitions, the state updater was structured as:
    ```typescript
    setLocalDistractorMap((prev) => ({ ...nextMap, ...prev }));
    ```
  - When switching from Question A to Question B, keys already existing in `prev` (from Question A) overrode keys in `nextMap` (Question B). This contaminated Question B's distractor rationale fields with Question A's text.
- **Architectural Solution**:
  - Replaced the spread updater with `setLocalDistractorMap(nextMap)` in [`IngestionOptionsEditor.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/IngestionOptionsEditor.tsx).
  - Ensured switching active questions performs a clean state replacement matching the active question's payload, avoiding cross-question distractor pollution.

#### Pattern 4: Worktree `staging/` Symlink Rule
- **Challenge**:
  - In the repository `.gitignore`, `staging/*` is ignored while `!staging/0455_s24_12.json` and `staging/.gitkeep` are actively tracked.
  - Replacing the entire `staging/` directory with a folder symlink to share raw PDF/JSON assets across git worktrees causes git to register a `typechange: staging` dirty working tree status, conflicting with worktree isolation and clean branch policies.
- **Architectural Solution**:
  - Keep the physical `staging/` directory intact.
  - Symlink individual untracked `*.json` files and the `staging/slices` directory inside `staging/`, ensuring git status remains 100% clean across worktrees without accidental dirty state or index locks.

## Session Reflection: Question Bank Multi-Dimensional Filter Architecture, Live Persistence & UI Streamlining (2026-10-16)

### Overview
This session delivered an end-to-end overhaul of the Question Bank in both the Teacher Portal and App Admin Console. We introduced a pure zero-DOM filter engine, replaced mock modulo derivations with deterministic heuristics and database fields, wired bidirectional URL parameter synchronization with active filter chips, deployed live Supabase schema migrations with B-tree indexes, and streamlined the layout to elevate curation tools directly to the top of the viewport.

### 1. Key Architectural Learnings & Patterns

#### Pattern 1: Pure Zero-DOM Question Bank Filter Engine (`lib/portal/bankFilters.ts`)
- **Challenge**:
  - The Question Bank previously relied on monolithic, client-bound filtering embedded directly within `AdminTools.tsx`, coupled with hardcoded modulo indexing (`idx % 3` for difficulty, `idx % 4` for accuracy, and hardcoded `May/June 2024` series).
  - This prevented robust SSR/Node verification and made multi-dimensional filtering across subject, year, season, variant, topics, and content features impossible.
- **Architectural Solution**:
  - Designed `lib/portal/bankFilters.ts` as a pure, zero-DOM-dependency module exporting canonical data contracts: `BankItemStatus`, `BankDifficulty`, `BankContentFeature`, `EnrichedBankQuestion`, and `BankFilterState`.
  - Implemented `parseCambridgePaperMetadata` and `normalizeSeriesToSeasonLabel` to decompose Cambridge citations (e.g., `0455/12 May/June 2024 Q1`) and IDs into clean discrete dimensions: `Subject` (`0455`), `Year` (`2024`), `Season/Series` (`m`/`s`/`w`), `Variant` (`12`), `Paper`, and `Session`.
  - Replaced modulo mocks with `deriveQuestionDifficulty` (combining explicit DB fields with deterministic structural complexity heuristics: Diagram/Table + Math -> `Hard`, Diagram/Table/Math/long stem -> `Medium`, else `Easy`) and `deriveQuestionStatus` (`Live`, `Agent draft`, `Needs review`, `Flagged`).
  - Implemented `detectQuestionFeatures` checking for visual diagrams (`image_url`, `diagram_metadata`, inline markdown), tabular data (`hasDataTable`), and mathematical calculations (`isMathOrCalculation`).
  - Added `computeBankFacetCounts` to dynamically aggregate option tallies with `{ value: 'All', count: total }` prepended, maintaining topic and syllabus sort orders.
  - Implemented bidirectional URL query state synchronization (`serializeBankFiltersToQuery` / `parseBankFiltersFromQuery`) and active filter chip lifecycle management (`getActiveFilterChips`, `removeActiveFilterChip`, `countActiveBankFilters`).

#### Pattern 2: Dual-Path Database Persistence & Live Migration
- **Challenge**:
  - Updating questions in the bank (bulk status changes, difficulty tagging, syllabus topic reassignments) required persisting changes across Supabase without breaking before schema migrations were executed.
- **Architectural Solution**:
  - Created `/api/questions/update/route.ts` and `updateQuestionsInDb` in [`lib/questions.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/questions.ts) supporting dual-path resilience:
    1. Direct updates to dedicated columns (`active`, `topic_id`, `status`, `difficulty`).
    2. Deep merging into `diagram_metadata` (`bank_status`, `difficulty`), preserving existing diagram crops and storage URLs even before remote schema alters.
    3. Real-time synchronization of in-memory `_cachedQuestions`.
  - Created and applied `supabase/migrations/20261016_question_bank_filter_columns.sql` to live Supabase project `dmvahcaxixvhgxidmkqs` using MCP tools (`apply_migration`), adding `status` and `difficulty` columns and 6 performance B-tree indexes (`idx_questions_subject_id`, `idx_questions_topic_id`, `idx_questions_active`, `idx_questions_status`, `idx_questions_difficulty`, and composite `idx_questions_subject_status_diff`).

#### Pattern 3: Top-Fold UI Streamlining
- **Challenge**:
  - The Question Bank view under `case 'bank':` in [`components/admin/AppAdminHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/admin/AppAdminHub.tsx) featured a massive top hero card (`Global Question Bank Intelligence`, `GLOBAL REPOSITORY` badge, and `+ Ingest Questions` CTA) coupled with an internal sub-tab pill switcher (`Assign Rounds / Question Bank`) in [`components/portal/AdminTools.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/AdminTools.tsx).
  - This pushed the actual filter bar and question table 300px+ down, forcing excessive scrolling and hiding core curation controls below the fold.
- **Architectural Solution**:
  - Stripped the redundant top hero card from `case 'bank':` in `AppAdminHub.tsx`, wrapping the table directly in a compact `<div className="space-y-2">` alongside the empty-pool alert.
  - Removed the sub-tab pill switcher in `AdminTools.tsx`, elevating the Question Bank search input, multi-select dropdowns, feature chips, and question records directly to the top of the viewport.

### 2. Verification & Live Evidence
- **Automated Verification Suite ([`scripts/verify-revizz.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-revizz.ts))**:
  - Suite 16 (`Question Bank Multi-Dimensional Filter Engine & Persistence Suite`) passed all 33 assertions, bringing total test coverage to 134/134 passing tests across 16 suites.
- **TypeScript Static Check**:
  - `npx tsc --noEmit` passed with 0 compilation errors across the entire codebase.
- **Remote Database Verification**:
  - Live PostgreSQL database verified via `execute_sql` on `dmvahcaxixvhgxidmkqs`: `status` and `difficulty` columns and all 6 B-tree indexes confirmed present and active.

## Session Reflection: Teacher Portal Test Compiler Upgrade, Right-Column Filter Consolidation & Semantic Citation Pill Decomposition (2026-10-17)

### Overview
This session delivered an end-to-end upgrade to the Teacher Portal Test Compiler ecosystem (`components/portal/compiler/TestCompilerHub.tsx`, `components/portal/compiler/PrintableExamLayout.tsx`, `lib/testCompiler.ts`, `lib/compilerFilters.ts`, and `app/portal/compiler/print/page.tsx`). We resolved the missing mark scheme explanations bug, introduced live teacher toggles for printed explanation keys, enforced Guardrail 6 against synthetic mock fallback leaks on the print page, added direct digital online quiz assignment workflows with topic distribution analytics and drag-and-drop reordering, eliminated visual duplication by consolidating all filter controls into the right-hand column with zero-wrap grid ergonomics, and replaced monolithic dark Cambridge citation tags with sanitized, semantic color-coded pills.

### 1. Key Architectural Patterns & Bug Remediations

#### Pattern 1: Teacher Mark Scheme Explanation Resolution & Live Print Toggles (`lib/testCompiler.ts`, `PrintableExamLayout.tsx`, `app/portal/compiler/print/page.tsx`)
- **Challenge & Bug Pattern**:
  - In `lib/testCompiler.ts`, the compiled question builder previously hardcoded `explanationMarkdown: null` for all compiled questions:
    ```typescript
    // Anti-Pattern: Hardcoded null discarded rich mark scheme explanations
    explanationMarkdown: null,
    ```
  - This prevented teachers from generating comprehensive teacher answer keys or printing full step-by-step explanations for students.
  - Furthermore, on `/portal/compiler/print`, when no test paper existed in `localStorage`, the page silently constructed an artificial fallback mock (`default-test`), violating Guardrail 6 (Zero-Fallback Data Layer & Empty Database Defense) and leaking synthetic mock data into printed exam papers.
- **Architectural Solution**:
  - Implemented `resolveQuestionExplanation(q: Question): string | null` in [`lib/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts), checking for existing `explanation_markdown` or synthesizing a clear syllabus-aligned explanation key (`Key ${q.correct_answer}: ...`) from verified question options and distractors.
  - Extended `TestPaperConfig` with `includeExplanations?: boolean` (defaulting to `false` for student papers and `true` for teacher answer keys).
  - Wired live reactive toggles in both the Test Assembly Drawer settings accordion and the `.no-print` sticky toolbar on [`app/portal/compiler/print/page.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/app/portal/compiler/print/page.tsx), enabling instant switching between clean student mark schemes (answer keys only) and annotated teacher mark schemes (full reasoning).
  - Enforced Guardrail 6 on `/portal/compiler/print`: removed the synthetic `default-test` fallback entirely, rendering a prominent Neobrutalist empty state card (`"📭 No Compiled Test Paper Found"` with `"Return to Test Compiler"` navigation button) whenever session storage or local storage contains no active compiled test.

#### Pattern 2: Direct Online Quiz Assignment, Topic Coverage Breakdown & Drag-and-Drop Assembly (`TestCompilerHub.tsx`, `lib/testCompiler.ts`)
- **Challenge**:
  - The Test Compiler was historically restricted to physical printable paper/PDF generation. Teachers had no mechanism to push an assembled question set directly into an interactive digital homework assignment without re-curating questions in a separate assignment builder.
  - Teachers also lacked real-time visibility into syllabus topic distribution and could not manually re-order questions or shuffle their sequence without tedious deselect/reselect cycles.
- **Architectural Solution**:
  - Designed the `OnlineQuizAssignment` data contract and persistence functions (`saveOnlineAssignment`, `listOnlineAssignments`, `loadOnlineAssignment`) in [`lib/testCompiler.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/lib/testCompiler.ts).
  - Embedded an accessible Neobrutalist **Assign Online** modal directly in the Test Assembly Drawer footer, allowing teachers to configure title, target class/cohort, due date, time limit, and instantaneous student release with auto-generated shareable assignment IDs.
  - Implemented `computeTopicDistribution(questions)` in `lib/testCompiler.ts`, rendering live percentage and question count pills (`Soft Lavender`) inside the assembly drawer to guarantee balanced syllabus coverage.
  - Added `shuffleQuestionIds` utilizing an immutable Fisher-Yates algorithm for instant 1-click test randomization.
  - Implemented native HTML5 drag-and-drop question reordering (`GripVertical` handle, `onDragStart`, `onDragOver`, `onDrop`) inside the selected questions queue for tactile manual sequencing.
  - Expanded dynamic `SUBJECT_CATALOG` to support full Cambridge science & humanities codes (`0455` Economics, `0610` Biology, `0620` Chemistry, `0625` Physics), and added a responsive floating mobile assembly bar (`lg:hidden`) for on-the-go compilation.

#### Pattern 3: Single-Source Right-Side Filter Consolidation & Zero-Wrap Grid Ergonomics (`TestCompilerHub.tsx`)
- **Challenge**:
  - The compiler interface suffered from layout redundancy: an extraneous left-column search & filter bar (`isFilterRowVisible`, `"Quick filter stems..."`, duplicate topic/diagram/math toggles) competed directly with the right-column **Question Filters** panel.
  - This visual duplication squandered vertical scanning space in the Question Bank, while the right-column utility buttons and content toggles experienced awkward text-wrapping and row height blowups on standard laptop viewports.
- **Architectural Solution**:
  - Completely excised the duplicate left-column filter bar, replacing it with a sleek, 1-line Question Bank header strip displaying total counts, active selection status, and batch selection actions (`Select All Filtered`).
  - Consolidated all search, syllabus topic filtering, series filtering, difficulty sorting, and content feature toggles into the dedicated right-column **Question Filters** card.
  - Engineered balanced, zero-wrap grid layouts:
    - Content switches laid out in a balanced 3-column grid (`grid-cols-3` for `Diagrams`, `Tables`, `Math`).
    - Utility buttons unified into an ergonomic 4-column action bar (`grid-cols-4` for `Preset`, `Drafts`, `Assign`, `Clear`).
    - Added a compact 1-line active filter summary strip (`text-xs text-text-muted`) when the filter card is collapsed, providing immediate context without requiring expansion.

#### Pattern 4: Branding Sanitization & Semantic Citation Pill Decomposition (`lib/compilerFilters.ts`, `TestCompilerHub.tsx`, `PrintableExamLayout.tsx`)
- **Challenge**:
  - Question cards throughout the compiler and printable papers rendered monolithic, raw citation badges (e.g. `CAMBRIDGE IGCSE ECONOMICS 0455/12 OCT/NOV 2024 Q1`) styled in dark heavy blocks.
  - These monolithic badges crowded question headers, visually conflicted with Revizz's 3D Neobrutalist design system, and leaked repetitive trademarked prefixes (`"Cambridge"`, `"IGCSE"`).
- **Architectural Solution**:
  - Authored `lib/compilerFilters.ts` containing pure formatting and parsing utilities:
    - `stripCambridgeIgcse(text: string): string`: Cleans out proprietary Cambridge/IGCSE prefixes while preserving all essential exam metadata.
    - `parseCitationTagPills(citation: string)`: Intelligently decomposes raw exam identifiers into discrete, structured citation components:
      - **Subject**: e.g., `Economics` (Sage Green: `bg-[#d8f3dc] text-[#1b4332] border-[#2d6a4f]`).
      - **Paper**: e.g., `0455/12` (Warm Terracotta: `bg-[#fde2e4] text-[#800f2f] border-[#c9184a]`).
      - **Series / Season**: e.g., `Oct/Nov 2024` (Sky Blue: `bg-[#d0f4de] text-[#134e4a] border-[#0f766e]`).
      - **Question**: e.g., `Q1` (Amber Gold: `bg-[#fef08a] text-[#713f12] border-[#a16207]`).
      - **Topic**: e.g., `Macroeconomic Objectives` (Soft Lavender: `bg-[#e0aaff] text-[#3c096c] border-[#5a189a]`).
  - Integrated discrete semantic citation pills across all question cards in [`TestCompilerHub.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/TestCompilerHub.tsx) and printable test layouts in [`PrintableExamLayout.tsx`](file:///Users/joelchong/Documents/MCQ%20App/Anti/components/portal/compiler/PrintableExamLayout.tsx).

### 2. Verification & Live Release Summary
- **Automated QA Test Suites ([`scripts/verify-revizz.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-revizz.ts))**:
  - Expanded test suites to cover citation decomposition, filter deduplication, explanation resolution, and online quiz assignment schemas.
  - All **109/109 assertions passed (100% pass rate)** with zero regressions across all 16 test suites.
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` verified clean with **0 compilation errors**.
- **Worktree Isolation & Atomic Production Release**:
  - Developed and verified across 3 dedicated git worktrees:
    - Worktree 1: Explanation resolution & print toggle wiring (`commit 6437511`).
    - Worktree 2: Direct online quiz assignment, topic distribution & drag-and-drop assembly (`commit 645aefe`).
    - Worktree 3: Right-column filter consolidation, zero-wrap grid ergonomics & semantic citation pill decomposition (`commit d3aa178`).
  - Rebased and released atomically to `origin/main`.
- **Live Vercel Production Verification**:
  - Production build compiled cleanly and deployed live to Vercel at `https://revizz-joelchong777-9527s-projects.vercel.app`.
  - Live HTTP 200 checks and DOM verification confirmed active print explanation toggles, online quiz modal triggers, clean right-column filter grids, and color-coded semantic citation pills.


## 2026-10-17 — Session Reflection: Teacher Portal (`/portal`) vs. Admin Portal (`/admin`) Table & Role Access Separation (`f0cadda`)

### Architectural Insights & Patterns
- **Dual-Mode Component Pattern (`portalMode?: 'teacher' | 'admin'`)**: Rather than duplicating the entire Question Bank filtering and Supabase query logic across two separate files, `components/portal/AdminTools.tsx` accepts `portalMode?: 'teacher' | 'admin'` (defaulting to `'admin'` for backward compatibility with existing admin callers and unit tests).
  - **Teacher Mode (`portalMode="teacher"`)**: Filters `baseBankQuestions` strictly to verified `Live` items (`st === 'Live'`), hides internal pipeline columns (`ID`, `Status`, `Updated`, selection checkboxes, and `Trash2` delete actions), hides bulk/create controls (`+ New question`, `Upload JSON`, `Bulk agent actions`, and Floating Mass Actions Deck), and renders a 6-column Educator table. Expanding a row displays a read-only Official Cambridge Content preview alongside an editable **Classroom Tags & Teacher Notes** panel persisted under `TEACHER_ANNOTATION_STORAGE_KEY` (`'revizz_teacher_question_annotations'`) plus an inline **Flag for Admin Review** action.
  - **Admin Mode (`portalMode="admin"`)**: Retains the full 10-column administrative table, all pipeline status tabs (`All`, `Live`, `Agent draft`, `Needs review`, `Flagged`), mass actions, and the `Open Full Editor` action routing to `AdminCMS`.
- **Sidebar & Route Access Guardrails**:
  - `components/portal/AdminNav.tsx` curates the Educator sidebar (`Overview`, `Classes & students`, `Assign rounds`, `Test compiler`, `Mastery analytics`, `Leaderboard & XP`, `Question bank`) while keeping `lib/portal/menuConfig.ts` (`DEFAULT_PORTAL_NAV_ITEMS`) untouched so storage/menu unit tests in Suite 15 remain 100% intact.
  - `app/portal/page.tsx` gates `?tab=editor`, `?tab=flagged`, and `?tab=school` with a neobrutalist Admin-Restricted Access Card, while `components/admin/AppAdminHub.tsx` (`case 'school'`) hosts the full interactive **School & Licence Management** suite (`Licence & Seat Quota Controls`, `Educator Seats & Permissions Table`, and `Institutional Cohorts Table`).

## 2026-10-18 — Session Reflection: Quiz First-Try Next CTA Popup, Citation Pill Elevation & Arrow Typography (`cd341b6`)

### Architectural Insights & UX Patterns
- **First-Try Fast Path Navigation Pattern (`components/QuestionCard.tsx`)**:
  - **Challenge**: In rapid revision mode, students who correctly answered a multiple-choice question on their first try were previously forced to scroll past the question card, through the 4 answer choices, and past the feedback explanation panel to find the "Next question" button at the bottom of the page.
  - **Solution**: Added a spring-animated CTA button (`isFirstTryCorrect`) positioned directly in the vertical flow between the question card (and retry alert) and the options radiogroup. When answered correctly on first try, the button surfaces immediately with `scale: 1, y: 0, opacity: 1` entry, allowing instantaneous 1-click progression without disrupting the feedback panel below.
  - **Hook Invariant (React Error #310 Defense)**: Guarded against conditional hook execution; all hooks (`useReducedMotion`, `useState`, `useRef`, `useEffect`) remain strictly unconditional at the top of `QuestionCard`.
- **Exam Citation Stack Hierarchy**:
  - Reordered the question card metadata pills container so that the official Cambridge exam citation (`question.citation || 'Cambridge IGCSE'`) is elevated to the top / first position in the badge stack, followed by subject and syllabus topic.
- **Micro-Interaction Typography & Arrow Separation**:
  - Separated the inline unicode arrow (`→`) from the button label string into a distinct `<span className="text-2xl font-black leading-none transition-transform group-hover:translate-x-1">→</span>` element. This avoids font glyph shrinkage and introduces an interactive hover slide effect while keeping the button centered and balanced.
  - Maintained Revizz signature terracotta styling (`bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-4`).

### Verification & Live Release Summary
- **QA Test Suite ([`scripts/verify-revizz.ts`](file:///Users/joelchong/Documents/MCQ%20App/Anti/scripts/verify-revizz.ts))**:
  - Added structural verification assertions checking citation pill precedence, first-try CTA placement between stem and options, spring physics tokens, and arrow typography.
  - All **136/136 test assertions passed (100% pass rate)**.
- **Worktree Rebase & Atomic Release**:
  - Developed and verified inside isolated worktree `.worktrees/user-test-green-btn`.
  - Rebased over upstream commits on `origin/main` (`4a1e3c8`), resolving neobrutalist `rounded-2xl` button corner styling.
  - Released atomically to `origin/main` (`cd341b6`).


## 2026-10-18 — Session Reflection: Diagram Zoom Overlay Obstruction Bug & Relocation to Dedicated Footer (`38209a4`)

### Architectural Insights & UX Bug Traps
- **Diagram Overlay Obstruction Trap (`components/QuestionCard.tsx`)**:
  - **Challenge**: The diagram zoom lightbox trigger pill was previously rendered as an absolute overlay inside the diagram image button (`absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-neutral-100/95 ...`). In authentic Cambridge exam questions (e.g. Economics 0455/13 Oct/Nov 2024 Q23), diagrams frequently contain tables, charts, axes, or footnotes in their bottom-right corners (e.g. CPI total weight `100`). The floating overlay badge obscured this critical examination data.
  - **Resolution**:
    - Removed `relative` and excised the floating `absolute bottom-2 right-2` overlay badge from inside the diagram button.
    - Restructured the non-error diagram container into a vertical flex layout (`flex flex-col items-center`) with a dedicated action bar below the diagram image.
    - Implemented a clean, accessible footer containing a subtle prompt (`Click diagram to enlarge`) and a tactile Neobrutalist `<span>🔍</span> Zoom` button (`bg-neutral-100 hover:bg-neutral-200 border-2 border-text shadow-offset-2`).
    - Retained full-image clickability (`cursor-zoom-in`, `hover:scale-[1.01]`) so students can click anywhere on the diagram or click the explicit Zoom button. Diagram content is guaranteed 100% visible with zero overlay occlusion across all device viewports.

### Verification & Live Release Summary
- **QA Test Suite & TypeScript Verification**:
  - `npx tsc --noEmit` verified clean with **0 type errors**.
  - `npm test` verified clean with **139/139 assertions passing** across all 19 test suites.
- **Worktree Isolation & Atomic Push**:
  - Created isolated worktree `.worktrees/zoom-button-pos` on branch `feat/zoom-button-pos-10181519` from `origin/main`.
  - Rebased and verified cleanly with pre-release gate.
  - Pushed atomically to `origin/main` (`38209a4`), triggering live Vercel redeployment.
  - Safely cleaned worktree and pruned branch via `npm run wt clean zoom-button-pos`.

## 2026-10-18 — Session Reflection: Teacher Portal Question Bank Diagram Supabase CDN Resolution & Lightbox Zoom (`feat/fix-portal-diagram`)

### Architectural Insights & UX Bug Traps
- **Missing CDN Canonicalization in Question Bank Table**:
  - **Issue**: Question rows expanded in Teacher Portal Question Bank (`/portal?tab=bank`) displayed broken image icons with alt text `Diagram for question Cambridge IGCSE Economics 0455/11 Oct/Nov 2024 Q29`.
  - **Root Cause**: Database records in Supabase store relative image paths (e.g. `image_url: "/questions/0455_2024_w_11_q29.png"`). In `AdminTools.tsx`, `imageUrl` was plugged directly into `<img src={item.imageUrl} />` without canonical transformation. On production Vercel, requests to `/questions/...` 404 because past paper diagrams are stored in the public Supabase Storage CDN (`question-diagrams` bucket at `https://dmvahcaxixvhgxidmkqs.supabase.co/storage/v1/object/public/question-diagrams/...`).
- **Comprehensive Resolution Across Portal Ecosystem**:
  - Imported and used `resolveDiagramUrl` from `@/lib/resolveDiagramUrl` across `AdminTools.tsx` (`createInitialBankItems` & `fetchLiveQuestions`), `AdminCMS.tsx`, `IngestionPreviewModal.tsx`, and `StagedPaperAuditor.tsx`.
  - Upgraded the static `<img>` preview inside `AdminTools.tsx` to use the battle-tested `CompilerDiagramPreview` component. This gives teachers and administrators an interactive, neobrutalist zoom lightbox modal, click-to-enlarge, keyboard `Esc` dismiss, and graceful asset retry states.

### Verification & Test Summary
- Verified with `npm run wt verify fix-portal-diagram`:
  - `npx tsc --noEmit` passed with 0 errors.
  - Standalone Node test runner passed **139/139 assertions (100% pass rate)**.
  - Codebase Atlas (`.agent/CODEBASE_MAP.md`) synchronized.


## 2026-10-18 — Session Reflection: Teacher Portal & Admin Console Minimalist Header Streamlining (`f33126a`, `2d60905`)

### Architectural Insights & UX Patterns
- **Breadcrumb-Only Minimalist Top Bar Pattern (`app/portal/page.tsx`, `app/admin/page.tsx`)**:
  - **Challenge**: Both the Teacher Portal (`/portal`) and Admin Console (`/admin`) previously rendered busy, information-heavy sticky top command bars. These headers displayed telemetry status badges (`Active Cohort: None Registered`, `Syllabus: Cambridge IGCSE 2024`, `Ingestion Engine: v2.4`, `Supabase DB Live Questions`) alongside external cross-navigation links (`Open App Admin 🛠️`, `Teacher Portal 🎓`, `Student Home ↗`). This visual clutter consumed scanning headroom, duplicated navigation paths already accessible in the main sidebar drawers (`AdminNav.tsx` and `AppAdminNav.tsx`), and distracted educators and administrators from their primary workflows.
  - **Architectural Solution**:
    - **Excised Telemetry & Cross-Link Blocks**: Completely removed secondary telemetry pill groups and right-aligned navigation buttons from desktop and mobile headers in both portals.
    - **Breadcrumb Page Title Preservation**: Preserved the semantic font-heading breadcrumb title (`Teacher Portal / <Active Section>` and `App Admin Console / <Active Tab>`), maintaining instant spatial orientation.
    - **Ergonomic Alignment**: Replaced `justify-between` spacing with clean `items-center` flex wrapping, allowing top navigation bars to gracefully scale down across laptop, tablet, and mobile breakpoints without awkward wrapping or vertical line expansion.
    - **Mobile Consistency**: Mobile headers now feature strictly the tactile hamburger menu toggle and the active section breadcrumb, eliminating crowded button clusters on narrow screens.

### Verification & Live Release Summary
- **QA Test Suite & TypeScript Verification**:
  - `npx tsc --noEmit` verified clean with **0 type errors**.
  - `npm test` verified clean with **139/139 assertions passing** across all 19 test suites.
- **Worktree Isolation & Atomic Push**:
  - **Teacher Portal**: Created `.worktrees/clean-portal-header`, verified, and released atomically to `origin/main` (`f33126a`).
  - **Admin Portal**: Created `.worktrees/clean-admin-header`, verified, and released atomically to `origin/main` (`2d60905`).
  - Both releases deployed live to production on Vercel with confirmed `HTTP 200` responses on `https://revizz-sand.vercel.app/portal` and `https://revizz-sand.vercel.app/admin`.

## 2026-10-18 — Session Reflection: Ingestion Studio Header Box Teardown & Streamlining (`9723e17`)

### Architectural Insights & UX Patterns
- **Header Box Pruning in Cambridge Ingestion Studio (`components/admin/AppAdminHub.tsx`)**:
  - **Challenge**: The Ingestion Studio view in the Admin Console previously rendered a persistent wrapper banner card above `<IngestionHub />`. This card contained a version badge (`INGESTION ENGINE v2.4`), title (`Cambridge Ingestion Studio`), and secondary jump buttons (`KaTeX Diagnostics`, `Question Bank →`). Because `IngestionHub` internally provides its own comprehensive workspace navigation, top actions, setup wizard, and progress indicators, this wrapper card duplicated navigation, cluttered the viewport, and pushed the primary ingestion dropzones and curation tools down the screen.
  - **Architectural Solution**:
    - Removed the redundant banner card `<div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl px-4 py-2.5 ...">` from `renderIngestion()` in `AppAdminHub.tsx`.
    - Streamlined `renderIngestion()` to directly mount `<div className="space-y-4"><IngestionHub /></div>`, preserving outer spacing while maximizing vertical canvas headroom for document review and diagram inspection.
    - Preserved diagnostics and question bank navigation within the dedicated Admin Navigation drawer (`AppAdminNav.tsx`).

### Verification & Live Release Summary
- **QA Test Suite & TypeScript Verification**:
  - `npx tsc --noEmit` verified clean with **0 type errors**.
  - `npm test` verified clean with **150/150 assertions passing** across all 20 test suites.
- **Worktree Isolation & Atomic Push**:
  - Executed inside dedicated worktree `.worktrees/remove-ingestion-header-box` on branch `feat/remove-ingestion-header-box-10182028`.
  - Released atomically to `origin/main` (`9723e17`) via `npm run wt ship remove-ingestion-header-box -m "feat(admin): remove redundant ingestion header box from Ingestion Studio page" --fast`.
  - Verified live on Vercel production with confirmed `HTTP 200` probe on `https://revizz-sand.vercel.app`.
  - Feature worktree safely dismantled and branch pruned.

## 2026-10-19 — Session Reflection: Admin Ingestion History Ledger & Batch Contents Inspector (`c1351ee`)

### Architectural Insights & Implementation Patterns
- **Chronological Ingestion Audit Ledger (`components/admin/IngestionHistoryHub.tsx` & `app/api/ingest/staged-paper/route.ts`)**:
  - **Requirement**: Administrators needed a dedicated page in the Admin Console (`/admin?tab=history`) showing every ingested past paper batch, when it was ingested/updated, its publication lifecycle state (`Published Live`, `Staged Review`, `Archived`), and an expandable inspector revealing the exact syllabus topic breakdown and question-by-question manifest inside each ingest.
  - **Backend Timestamp & Topic Distribution Enrichment**:
    - Extended `StagingPaperSchema` and `StagedPaperSummary` in `types/ingestion.ts` with optional `ingested_at`, `updated_at`, `published_at`, `activeCount`, `needsReviewCount`, `withdrawnCount`, `topicsCount`, `topicBreakdown`, `source_qp_filename`, and `source_ms_filename`.
    - Updated `GET /api/ingest/staged-paper` to synthesize timestamps across JSON payload fields, local filesystem `fs.statSync` (`birthtime` / `mtime`), and Supabase Storage metadata (`created_at` / `updated_at`), while computing per-paper question status counts and syllabus topic distributions (`topicBreakdown`).
    - Updated `POST /api/ingest/staged-paper` to automatically stamp `ingested_at` and `updated_at` ISO timestamps whenever a paper is staged or updated.
  - **Frontend Audit Ledger & Expandable Inspector (`IngestionHistoryHub.tsx`)**:
    - Built with strict React Error `#310` compliance (all 16 hooks declared unconditionally at the top of the component) and canonical diagram URL resolution via `resolveDiagramUrl()`.
    - Includes 4 KPI summary cards, search/status/subject/sort controls, and an expandable `"What Was In This Ingest"` panel displaying the interactive syllabus topic distribution grid and searchable question-by-question manifest with one-click handoffs to **Ingestion Studio** (`loadPreset`) and the **Admin Question Editor** (`onOpenEditor`).

### Verification & Live Release Summary
- **QA Test Suite & TypeScript Verification**:
  - `npx tsx scripts/verify-ingestion-history.ts`: 16/16 checks passed.
  - `npx tsx scripts/verify-fake-data-purge.ts`: 0 forbidden strings across all checked files.
  - `npm run wt verify ingestion-history`: `npx tsc --noEmit` (0 errors) and `npm test` (150/150 tests passing).
- **Worktree Isolation & Atomic Push**:
  - Shipped atomically via `npm run wt ship ingestion-history` (`c1351ee`) to `origin/main` and verified live on Vercel (`https://revizz-sand.vercel.app` returned `HTTP 200`).
  - Worktree `.worktrees/ingestion-history` and branch `feat/ingestion-history-10182014` cleaned up and pruned.

## 2026-10-19 — Session Reflection: Test Compiler "Assign Online Quiz" Popup & Universal Neobrutalist Dropdowns (`2cc6290`)

### Architectural Insights & UX Patterns
- **Uniform 3D Neobrutalist Dropdown Overhaul in Test Compiler (`components/portal/compiler/TestCompilerHub.tsx`)**:
  - **Challenge**: The "Assign Online Quiz" popup in the Test Compiler previously utilized a native browser `<select>` with a thin border and standard browser focus outlines, clashing with Revizz's playful, tactile 3D Neobrutalist aesthetic. Form inputs lacked tactile styling, student access codes were left empty/unformatted, and deadlines/time limits required manual typing.
  - **Custom Animated Cohort Dropdown Architecture**:
    - Replaced native `<select id="assign-cohort-select">` with a custom Neobrutalist trigger button (`border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] rounded-xl bg-white`) featuring smooth rotating `ChevronDown` physics.
    - Integrated an animated dropdown menu using `framer-motion` (`AnimatePresence` + `motion.div` with spring transition, `shadow-[4px_4px_0_0_#201e1d] rounded-2xl bg-[#FFFDF7]`).
    - Handled outside clicks (`handleClickOutside`) and keyboard dismissals (`Escape`).
    - Added an interactive inline `+ Enter Custom Cohort` mode allowing teachers to type and save custom class names directly within the dropdown.
  - **Interactive Form Inputs & Quick-Select Preset Chips**:
    - **Due Date**: Neobrutalist input paired with tactile shortcut chips (`Tomorrow`, `3 Days`, `1 Week`) that calculate and inject ISO dates instantly.
    - **Time Limit**: Bidirectional numeric input paired with quick duration pills (`15m`, `30m`, `45m`, `60m`, `Untimed`).
    - **Student Access Code Generator**: Auto-generates branded access codes (`REV-0455-XXXX`) on modal open, formatted in bold uppercase monospace with a 1-click **Regenerate** button (`RefreshCw`) and 1-click **Copy Code** button (`Copy` / `Check`) with visual `"Copied!"` feedback.
    - **Tactile Overview Card**: Converted the plain banner into an overview card (`border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] bg-[#f0fae1] rounded-2xl`) displaying subject, question count, and marks badges.
  - **Universal Dropdown Polish Across Compiler**:
    - Polished the Series Filter (`#compiler-series-filter`), Sort Control (`#compiler-sort-control`), Subject Catalog (`#settings-subject-select`), and Auto-Generate Modal (`#auto-count-select`) with matching `border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]`.

### Verification & Live Release Summary
- **QA Test Suite & TypeScript Verification**:
  - `npx tsc --noEmit` verified clean with **0 type errors**.
  - `npm test` verified clean with **150/150 assertions passing** across all 20 test suites.
- **Worktree Isolation & Atomic Push**:
  - Isolated on branch `feat/compiler-assign-online-ui-10182023` in `.worktrees/compiler-assign-online-ui`.
  - Shipped atomically to `origin/main` (`2cc6290`) via `npm run wt ship compiler-assign-online-ui --fast`.
  - Verified live on Vercel production with confirmed `HTTP 200` probe on `https://revizz-sand.vercel.app`.
  - Dev server stopped, worktree dismantled, and branch pruned cleanly.

## 2026-10-19 — Session Reflection: Admin Whole Paper Viewer & Live Supabase Database Ingestion Wiring (`73ffcca`)

### Architectural Insights & UX Patterns
- **Whole Paper Inspection Engine (`components/admin/WholePaperViewer.tsx` & `/admin?tab=papers`)**:
  - **Requirement**: Administrators needed a dedicated surface in the Admin Deck to view complete, sequential Cambridge past exam papers (Q1–Q30/Q40) with authentic question citations, KaTeX mathematics formatting, zoomable diagram crops, option-by-option distractor analysis, and a print-optimized A4 stylesheet.
  - **Interactive Jump Bar & Dual View Modes**:
    - Built a sticky horizontal question navigator bar (`Q1` to `Q30`) with diagram indicators and smooth anchor scrolling.
    - Added dual view toggles: **Continuous Exam Paper** (detailed cards with collapsible derivations) and **Mark Scheme Table** (quick tabular key reference).
    - Integrated text search, diagram-only filtering, and topic filters.
- **Live Supabase PostgreSQL Wiring & Server/Client Boundary Defense**:
  - **Bug Traps & Resolution**:
    1. *Next.js 15 Client Hook Violation*: Route handler `/api/ingest/staged-paper/route.ts` initially imported `CAMBRIDGE_QUESTIONS` from `lib/questions.ts`, which contains `useState` and `useEffect` (for `useQuestions`), breaking Next.js server route compilation. Resolved by decoupling server helpers into `lib/ingestion/stagedPaperStorage.ts` with zero client hook dependencies.
    2. *Database vs Disk Divergence*: Real production papers live in Supabase PostgreSQL (`papers`, `questions`, `question_options`, `topics`), whereas the initial viewer only queried local disk files (which were not on Vercel serverless containers).
    3. *Dynamic PostgreSQL Paper Querying*: Added `fetchLiveSupabasePapers()` and `fetchLiveSupabasePaperDetail()` in `stagedPaperStorage.ts`. The API dynamically queries live Supabase tables, maps records to the validated `StagingPaper` schema, and decorates papers with `🟢 [LIVE IN DB]` vs `🟡 [STAGED]` badges.
    4. *Production Asset Completeness*: Committed 267 official Cambridge diagram crops (`public/questions/*.png`) and 20 staging catalog JSONs so that Vercel production serves all diagrams and papers with zero missing assets.

### Verification & Live Release Summary
- **QA Test Suite & TypeScript Verification**:
  - `npx tsx scripts/verify-paper-viewer.ts`: **66/66 assertions passing** (testing staging discovery, schema validation, fallback generation, live Supabase queries, and route handlers).
  - `npm test`: **150/150 assertions passing** across all 20 test suites.
  - `npx tsc --noEmit`: Clean with **0 type errors**.
- **Worktree Isolation & Atomic Push**:
  - Built and tested inside `.worktrees/live-paper-wiring` on branch `feat/live-paper-wiring-10190146`.
  - Rebased cleanly onto latest `origin/main` and shipped atomically via `npm run wt ship live-paper-wiring` (commit `73ffcca`).
  - Production deployment verified live on Vercel (`https://revizz-sand.vercel.app/admin?tab=papers` and `https://revizz-sand.vercel.app/admin/papers` returned confirmed `HTTP 200` probes).
  - Isolated worktree safely removed and feature branch pruned.



## Reflection Log Entry - 2026-10-19 (Student Profile Hub, Bookmarks, Round Telemetry & Mobile/Tablet Vertical Layout)

- **Date**: 2026-10-19
- **Feature / Area**: Post-Login Student Profile Hub (`lib/studentProfile.ts`, `components/profile/*`, `app/profile/*`, `components/LeaderboardModal.tsx`, `components/QuestionCard.tsx`, `hooks/useQuizGame.ts`, `components/AppShell.tsx`)
- **Architectural & UI Improvements**:
  1. **Student Profile Engine (`lib/studentProfile.ts`)**: Built SSR-safe pure module managing `StudentPreferences` (synced two-way with `revizz_last_config`), Cambridge exam countdowns (`Feb/Mar`, `May/June`, `Oct/Nov`), question bookmarks (`revizz_bookmarked_questions_v1`), completed round telemetry (`revizz_student_round_history_v1`), 7-day daily goal progress, 7 XP rank levels, 8 unlockable achievements, and syllabus mastery summaries.
  2. **5-Tab Student Profile Hub (`/profile`)**: Built `StudentProfileHub.tsx`, `StudentStatsPanel.tsx`, `StudentReviewPanel.tsx`, `StudentAchievementsActivityPanel.tsx`, and `StudentSettingsPanel.tsx` with sub-routes (`/profile/stats`, `/profile/review`, `/profile/settings`), in-quiz question bookmarking (`QuestionCard.tsx`), and deep-linked custom drills (`/?drill=custom&ids=...`).
  3. **Mobile & Tablet Vertical Stack Rule (Bug Pattern & Lesson)**: Because `AppShell.tsx` frames student routes inside `max-w-xl md:max-w-2xl` (`576px`–`672px`), desktop viewport media queries (`md:grid-cols-2`, `md:grid-cols-3`, `lg:grid-cols-7`) still fire on laptops/tablets and crush multi-column cards to `~150px–240px`. Student views inside `AppShell.tsx` must use a **1-column vertical card stack (`flex flex-col gap-4`)** for content cards, at most `grid-cols-2` for compact KPI tiles, a 5-column icon-over-label tab dock, `min-w-0 flex-1` on text columns, and `shrink-0 whitespace-nowrap` on buttons/badges.
- **Verification & Deployment**:
  - Verified with `npm run wt verify student-profile-hub` (`0` TS errors, `150/150` QA tests + `8/8` student profile suites passing).
  - Shipped live via `npm run wt ship student-profile-hub --fast` to `origin/main` (`268bf2c`) and Vercel (`https://revizz-sand.vercel.app`, HTTP 200 OK).
