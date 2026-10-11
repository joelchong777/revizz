# Revizz Ingestion Studio Architecture & UI/UX Specification

## 1. System Overview & Objectives

**Revizz Ingestion Studio** is a high-throughput, web-based past paper digitization and curation workstation tailored for Cambridge Assessment International Education (CAIE) Multiple Choice Question (MCQ) examinations (currently focused on IGCSE / O-Level Economics `0455`, with expandable architecture for additional sciences and humanities).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      REVIZZ INGESTION PIPELINE                         │
├─────────────────┬────────────────────┬─────────────────┬───────────────┤
│ 1. Extraction   │ 2. Curation Studio │ 3. Verification │ 4. Publishing │
│                 │                    │                 │               │
│ • CAIE Past PDF │ • IngestionHub     │ • Diagnostics   │ • Supabase DB │
│ • Mark Scheme   │ • Stem Editor      │ • Game Preview  │ • Storage     │
│ • Gemini Vision │ • KaTeX Sanitizer  │ • verify-nav    │ • Production  │
│ • Diagram Crop  │ • Options Matrix   │ • verify-revizz │   Question    │
│                 │ • 2-Column Layout  │                 │   Bank        │
└─────────────────┴────────────────────┴─────────────────┴───────────────┘
```

### Core Objectives
1. **Zero-Friction Ingestion**: Transform raw past exam papers and mark schemes into structured, schema-validated JSON (`StagingPaper`).
2. **Pedagogical Integrity**: Ensure every question includes rigorous step-by-step syllabus explanations, distractor analysis (why options B, C, D are incorrect), and official Cambridge syllabus topic mapping.
3. **KaTeX Mathematical Perfection**: Sanitize, auto-repair, and validate LaTeX mathematical notation, avoiding unclosed delimiters, mismatched braces, or currency symbol corruption (e.g., distinguishing currency `\$100` from LaTeX delimiters `$100$`).
4. **Interactive Fidelity**: Allow educators and curators to test the student gameplay experience directly within the studio using a real-time Gameboy student simulator featuring the exact 2-try mastery loop, sound synthesis, and particle confetti.
5. **Atomic Supabase Publishing**: Validate all 30–40 questions in a paper batch and push them atomically to Supabase database tables (`subjects`, `papers`, `topics`, `questions`).

---

## 2. Component Directory & Responsibilities

All studio components live under `components/portal/Ingestion*.tsx`:

```
components/portal/
├── IngestionHub.tsx             # Root layout orchestrator & drawer controller
├── IngestionHeader.tsx          # Top navigation bar, health indicator & overflow menu
├── IngestionQuestionNav.tsx     # Left question list, filter chips & status matrix
├── IngestionStemEditor.tsx      # Question stem editor & KaTeX formula toolbar
├── IngestionOptionsEditor.tsx   # 4-Option MCQ editor with 1-4/A-D keyboard shortcuts
├── IngestionMediaPanel.tsx      # Diagram lightbox & progressive disclosure accordions
├── IngestionLivePreview.tsx     # Slide-over student simulator with 2-try mastery loop
├── IngestionDiagnostics.tsx     # Automated 7-point QA test suite runner
├── IngestionAuditDrawer.tsx     # Paper-wide batch health & issue inspector
└── IngestionModals.tsx          # Settings & JSON payload inspect modals
```

### Detailed Component Roles

| Component | Primary Responsibility | Key Features & Interactions |
| :--- | :--- | :--- |
| **`IngestionHub.tsx`** | Top-level workspace container and state mediator. | • Renders the 2-Column Focus Layout.<br>• Manages the Slide-over Preview Drawer (`showLivePreview`).<br>• Listens to localStorage drafts and auto-saves on state mutations.<br>• Loads default preset (`0455_s24_12`) or user uploaded files. |
| **`IngestionHeader.tsx`** | Global paper metadata, health score, and primary CTAs. | • Health score badge (`percentage%`) with dynamic traffic-light dot color.<br>• Two prominent action buttons: `[👁 Preview]` and `[Push Live]`.<br>• Neobrutalist `[···]` overflow dropdown for secondary actions (Preset selection, JSON upload, JSON payload inspection, settings, full-paper audit). |
| **`IngestionQuestionNav.tsx`** | Master list of all questions in the paper (~22% width). | • Metric badges: Total count, Valid count, Needs Review, Diagrams.<br>• Filter chips: `All`, `Valid`, `Review`, `Diagrams`.<br>• Question list cards with topic chip, diagram indicator, and validation dot.<br>• Global keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`). |
| **`IngestionStemEditor.tsx`** | Question stem markdown and mathematical formula composition. | • Live markdown & KaTeX formula preview split view.<br>• KaTeX Formula Toolbar (primary math symbols + `[+ More Math]` popover).<br>• Real-time KaTeX syntax analyzer (`detectKatexErrors`) checking unmatched `$` and unbalanced braces.<br>• Reordering buttons (`Move Up`, `Move Down`, `Duplicate`, `Delete`). |
| **`IngestionOptionsEditor.tsx`** | 4-option stacked cards (A, B, C, D). | • Clickable radio button badges for marking the correct answer.<br>• Hotkeys `1-4` or `A-D` for instant correct answer assignment.<br>• Inline KaTeX rendering for mathematical options.<br>• Validation styling highlighting missing options or empty text. |
| **`IngestionMediaPanel.tsx`** | Media and curricular metadata editor with progressive disclosure. | • **Accordion 1**: Diagram & Figures (auto-collapses if no diagram, auto-expands if diagram exists; full lightbox zoom & file uploader).<br>• **Accordion 2**: Syllabus Topic selector & step-by-step derivation markdown editor with tabbed views (`Split`, `Edit`, `Preview`). |
| **`IngestionLivePreview.tsx`** | Authentic student gameplay simulator inside the preview drawer. | • Gamified 2-try mastery loop (1st try 10 XP + green fanfare; wrong try strikeout + buzzer; 2nd try retry + 5 XP chime).<br>• Realistic confetti celebration and sound synthesis via Web Audio.<br>• Quick test bench triggers (`Simulate 1st Try Right`, `Simulate 1st Try Fail`). |
| **`IngestionDiagnostics.tsx`** | 7-point QA automated validation suite for the selected question. | • Real-time check on stem text, 4 options, 1 correct answer, KaTeX syntax, diagram completeness, derivation quality, and syllabus topic. |
| **`IngestionAuditDrawer.tsx`** | Batch paper diagnostics drawer. | • Summarizes paper-wide health, missing explanations, unassigned topics, and broken KaTeX equations across all 30–40 questions. |
| **`IngestionModals.tsx`** | Modal dialogs for configuration and export. | • `IngestionSettingsModal`: Subject code, paper year, series, variant, syllabus topic taxonomy.<br>• `IngestionPayloadModal`: Direct JSON inspection, download, and copy-to-clipboard. |

---

## 3. Store Architecture (`lib/ingestion/useIngestionStore.ts`)

The Ingestion Studio utilizes an external micro-state store built on React's `useSyncExternalStore`. This provides subscription-based, tearing-free state synchronization across components without the overhead of heavy third-party state managers.

### Store Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│             useIngestionStore (Singleton)              │
├──────────────────────────┬─────────────────────────────┤
│ State                    │ Actions                     │
│ • paper: StagingPaper    │ • loadPreset(id)            │
│ • selectedIdx: number    │ • loadJson(content)         │
│ • showLivePreview: bool  │ • updateQuestion(idx, data) │
│ • publishStatus: string  │ • setCorrectOption(label)   │
│ • statusFilter: string   │ • publishToSupabase()       │
│ • isAuditDrawerOpen: bool│ • saveDraftToLocalStorage() │
└──────────────────────────┴─────────────────────────────┘
          │                                  ▲
          │ State updates                    │ Dispatches
          ▼                                  │
┌──────────────────────────┐       ┌─────────────────────┐
│ Components               │       │ User Interactions   │
│ IngestionHub, Nav,       │──────▶│ Hotkeys (1-4, A-D)  │
│ StemEditor, Options, etc.│       │ Clicks, Inputs      │
└──────────────────────────┘       └─────────────────────┘
```

### Core Store Interfaces

```typescript
export interface IngestionState {
  paper: StagingPaper | null;
  selectedIdx: number;
  showLivePreview: boolean;
  isSettingsModalOpen: boolean;
  isPayloadModalOpen: boolean;
  isAuditDrawerOpen: boolean;
  publishStatus: 'idle' | 'validating' | 'publishing' | 'success' | 'error';
  publishMessage: string;
  searchQuery: string;
  statusFilter: 'all' | 'valid' | 'review' | 'diagrams';
}

export interface IngestionActions {
  loadPreset: (id?: string) => Promise<void>;
  loadJson: (jsonContent: any) => { success: boolean; errors?: string[] };
  updatePaperMetadata: (updates: Partial<StagingPaper>) => void;
  setSelectedIdx: (idx: number) => void;
  addQuestion: () => void;
  deleteQuestion: (idx: number) => void;
  duplicateQuestion: (idx: number) => void;
  moveQuestion: (fromIdx: number, toIdx: number) => void;
  updateQuestion: (idx: number, updated: StagingQuestion) => void;
  setCorrectOption: (label: 'A' | 'B' | 'C' | 'D') => void;
  publishToSupabase: () => Promise<{ success: boolean; data?: any; error?: string }>;
  saveDraftToLocalStorage: (storageKey?: string) => boolean;
  loadDraftFromLocalStorage: (storageKey?: string) => boolean;
  clearDraft: (storageKey?: string) => void;
  setShowLivePreview: (show: boolean | ((prev: boolean) => boolean)) => void;
  /* ...modal & filter toggles */
}
```

### Draft Persistence Protocol
To prevent data loss during accidental navigation or browser refreshes:
1. Every update to `paper` triggers `saveDraftToLocalStorage()` writing to the key `revizz_ingestion_draft`.
2. On initial load, `IngestionHub` calls `loadDraftFromLocalStorage()`. If an existing draft is detected, it restores the session; otherwise, it falls back to loading the default staged preset (`0455_s24_12`).

---

## 4. UI/UX Design System & Architectural Redesign

### 4.1. 2-Column Focus Layout (Replacing 3-Column Split)
Prior versions utilized a 3-column split (`Question Nav` | `Editor` | `Live Simulator Preview`). On standard laptop screens (13" to 15" viewports, 1280px–1440px wide):
- The central editor column was squeezed down to < 500px, causing KaTeX equations and multi-line option textareas to wrap awkwardly and induce cognitive fatigue.
- The simulator preview permanently occupied ~400px of width even when the curator was purely typing or reviewing text.

**The Solution: 2-Column Focus Layout**:
- **Navigation Column (~22% width, 240px–320px)**: Compact question matrix with validation indicators and filter chips.
- **Main Authoring Workspace (~78% width)**: Spacious, uncluttered focus area for Question Stem, Option Cards, Diagram Lightbox, and Derivation.
- **Adaptive Canvas**: When the Live Preview drawer is opened, wide monitors (≥ 1536px / 2xl) smoothly add a `2xl:mr-[550px]` margin, keeping the authoring area centered without overlap.

### 4.2. Slide-Over Preview Drawer
- Mounted via fixed off-canvas container: `fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[500px] xl:w-[540px]`.
- Triggered on-demand via the header `[👁 Preview]` button.
- Dismissible via `Escape` key, backdrop click on smaller screens, or top-right `[X]` button.
- Combines the interactive student Gameboy simulator (`IngestionLivePreview`) and 7-point QA checks (`IngestionDiagnostics`) in a single vertical scroll view.

### 4.3. Progressive Disclosure & Button Fatigue Reduction

#### Header Action Consolidation
Instead of displaying 7+ top-level action buttons that overwhelmed the navigation bar, the header is streamlined to:
1. **Traffic Light Health Indicator**: High-contrast badge showing total paper validity (`Health: 93%`). Green (`#22C55E`) for ≥90%, Yellow (`#FACC15`) for 50–89%, and Coral (`#FB7185`) for <50%.
2. **Two Primary CTAs**:
   - `[👁 Preview]`: Teal toggle button activating the slide-over drawer.
   - `[Push Live]`: Vibrant green publishing trigger.
3. **`[···]` Overflow Menu**: Houses secondary management actions:
   - Preset loader (`0455_s24_12`, `0455_w23_11`, etc.)
   - Upload JSON file
   - View/Copy Raw JSON Payload
   - Paper Settings Modal
   - Paper-wide Audit Drawer
   - Open Live Portal link

#### Media & Derivation Accordions
In `IngestionMediaPanel.tsx`:
- **Diagram Accordion**: Defaults to **collapsed** when a question has no diagram (`has_diagram: false`), reducing vertical scrolling. Automatically expands if diagram assets exist.
- **Syllabus & Derivation Accordion**: Defaults to expanded with instant split-pane tab switching (`Split`, `Edit`, `Preview`).

### 4.4. Rapid Keyboard Shortcuts
Educators can review an entire 30-question paper without leaving the keyboard:

| Shortcut | Target Component | Action |
| :--- | :--- | :--- |
| `1` or `A` | `IngestionOptionsEditor` | Sets Option A as the correct answer. |
| `2` or `B` | `IngestionOptionsEditor` | Sets Option B as the correct answer. |
| `3` or `C` | `IngestionOptionsEditor` | Sets Option C as the correct answer. |
| `4` or `D` | `IngestionOptionsEditor` | Sets Option D as the correct answer. |
| `ArrowUp` / `ArrowLeft` | `IngestionQuestionNav` | Navigates to the previous question. |
| `ArrowDown` / `ArrowRight` | `IngestionQuestionNav` | Navigates to the next question. |
| `Home` / `End` | `IngestionQuestionNav` | Jumps to the first or last question in the paper. |
| `Escape` | Global / Drawer / Modals | Closes active Drawer, Lightbox, or Overflow Menu. |

*(Note: Hotkeys `1-4`/`A-D` and arrows automatically yield when cursor focus is inside an `<input>`, `<textarea>`, or contentEditable element).*

### 4.5. KaTeX Formula Toolbar & Syntax Analysis

The formula toolbar in `IngestionStemEditor.tsx` provides instant snippet insertion:
- **Primary Quick-Insert Tools**:
  - `$x$` (Inline math delimiter)
  - `$$\dots$$` (Display math block)
  - `\frac{a}{b}` (Fractions)
  - `\times` (Multiplication symbol)
  - `\Delta` (Delta / change)
- **Extended Math Popover (`[+ More Math]`)**:
  - `\%` (Escaped percentage)
  - `\pm` (Plus-minus)
  - `\approx` (Approximately equal)
  - `\rightarrow` (Yields / Arrow)
  - `x^2` (Superscript power)
  - `x_i` (Subscript index)
  - `\sum` (Summation)
  - `\text{...}` (Plain text inside equation)
- **Automated Sanitize & Repair (`katexSanitizer.ts`)**:
  - Automatically escapes standalone dollar signs (`$50` → `\$50`).
  - Cleans malformed LaTeX environments, broken unicode characters, and converts raw text multiplication signs (`x`) to `\times`.

---

## 5. Verification & Testing Suite

Revizz maintains a strict zero-regression verification policy.

### 5.1. Nav & Validation Unit Suite (`scripts/verify-ingestion-nav.ts`)
Validates core Cambridge question requirements:
```bash
npx tsx scripts/verify-ingestion-nav.ts
```
**Test Coverage**:
1. Passes valid questions with non-empty stems, 4 options, and 1 correct answer.
2. Detects missing or whitespace-only stem texts.
3. Detects invalid option counts (<4 or >4).
4. Catches missing correct options (0 correct answers).
5. Catches duplicate correct options (>1 correct answers).
6. Detects diagrams via `has_diagram: true`, `image_url`, `storage_path`, or embedded markdown images (`![...]`).

### 5.2. Comprehensive Game & Ingestion QA Suite (`scripts/verify-revizz.ts`)
Executed via `npm test`:
```bash
npm test
```
*(Runs TypeScript compilation to `dist-test` and executes via `node --experimental-websocket` to support Supabase client real-time sockets in Node 20).*

**31 End-to-End Tests Across 6 Diagnostic Suites**:
1. **Scoring & Streak Multipliers**: Verifies base 10 XP, 1.2x streak multiplier (streak ≥ 3), 1.5x streak multiplier (streak ≥ 5), 50% XP for 2nd try recoveries (5 XP), and streak resets.
2. **Review Pile Queuing**: Verifies Leitner spaced repetition queuing logic (first-try correct excluded; wrong or retry questions queued).
3. **Topic Mastery Thresholds**: Validates Novice (<50%), Proficient (50%–80%), and Master (>80%) classifications.
4. **Auth Display Name Sanitization**: Verifies privacy-compliant name masking (e.g., `Alex Miller` → `Alex M.`) and school domain matching (`@frontierinternational.edu`).
5. **Timer Math & End-to-End Gameplay**: Simulates a 5-question round with real timer step decrements and score aggregations.
6. **Portal Gate Security**: Validates role-based educator/admin access and production devOverride hardening.

---

## 6. Publishing Workflow to Supabase

```
[StagingPaper JSON]
       │
       ▼
validateStagingPaper()
       │
  (Passes 100%)
       ▼
POST /api/ingest/publish-paper
       │
 ┌─────┴────────────────────────────────────────────────┐
 │ Transactional Database Mutations                     │
 │ 1. Upsert Subject into `subjects`                     │
 │ 2. Upsert Paper into `papers`                         │
 │ 3. Upsert Syllabus Topics into `topics`               │
 │ 4. Atomic Upsert of Questions into `questions`:       │
 │    • Map options to `options` JSONB column           │
 │    • Link `topic_id` foreign key                     │
 │    • Store diagram image URLs & bounding metadata    │
 └─────┬────────────────────────────────────────────────┘
       │
       ▼
200 OK: Paper Live in Question Bank
```

When all verification checks pass, educators click **`[Push Live]`** in `IngestionHeader.tsx`. The endpoint `/api/ingest/publish-paper` executes an idempotent upsert, making the questions immediately available to students in practice quizzes and teacher tests.
