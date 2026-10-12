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
