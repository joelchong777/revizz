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

