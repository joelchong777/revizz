---
name: revizz-ingestion-studio
description: Cambridge exam paper ingestion studio workflows, neobrutalist UI/UX standards, and data schema
---

# Revizz Ingestion Studio Skill

This skill defines the operational protocols, schema specifications, KaTeX mathematical rules, diagram asset pipelines, and neobrutalist UI/UX standards for digitizing, curating, and publishing Cambridge Assessment International Education (CAIE) Multiple Choice Question (MCQ) past papers in **Revizz Ingestion Studio**.

---

## 1. Overview & Cambridge Ingestion Pipeline

Revizz ingests Cambridge IGCSE and O-Level past papers (e.g. `0455` Economics, `0620` Chemistry, `0625` Physics) into interactive, gamified learning modules.

The pipeline transitions raw PDF papers through 4 distinct stages:
1. **Extraction**: Gemini Vision and PDF parsing extracts raw question stems, 4 options, mark schemes, and diagram coordinates into a JSON staging draft.
2. **Sanitization**: KaTeX sanitization converts raw equations and currency marks into robust, renderer-safe LaTeX.
3. **Curation Studio**: Educators verify options, assign syllabus topics, compose step-by-step derivations with distractor analyses, and test the student experience via the live Gameboy simulator.
4. **Supabase Publishing**: Validated batches are pushed atomically to Supabase database tables (`subjects`, `papers`, `topics`, `questions`).

---

## 2. Staging Data Schema & Validation Rules

All staging papers conform to the TypeScript definitions in `@/types/ingestion.ts`.

### 2.1. Staging Schema Hierarchy

```typescript
export interface StagingPaper {
  id: string; // e.g. "0455_s24_12"
  subject: {
    code: string; // "0455"
    name: string; // "Economics"
    level: "IGCSE" | "O-Level" | "A-Level";
    icon?: string; // "📈"
  };
  paper: {
    year: number; // 2024
    series: "m" | "s" | "w"; // m=March, s=May/June, w=Oct/Nov
    paper_code: string; // "12" (Paper 1, Variant 2)
  };
  syllabus_topics: Array<{
    name: string;
    order_index: number;
  }>;
  questions: StagingQuestion[];
}

export interface StagingQuestion {
  question_number: number; // 1..30
  cambridge_source_ref: string; // e.g. "0455/12/M/J/24 Q1"
  topic_name: string; // Must match syllabus_topics name
  stem_markdown: string; // KaTeX-enabled markdown stem
  diagram: {
    has_diagram: boolean;
    image_url?: string;
    storage_path?: string;
    alt_description?: string;
  };
  options: StagingOption[]; // Exactly 4 options (A, B, C, D)
  explanation_markdown: string; // Step-by-step derivation & distractor analysis
  status: "active" | "needs_review" | "withdrawn";
}

export interface StagingOption {
  label: "A" | "B" | "C" | "D";
  content_markdown: string;
  is_correct: boolean;
}
```

### 2.2. Strict Validation Contract (`getQuestionValidation`)
A question is considered **Valid** if and only if:
1. `stem_markdown` is non-empty and contains substantive prompt text.
2. `options` array contains exactly 4 elements labeled `A`, `B`, `C`, and `D`.
3. Exactly **one** option has `is_correct === true` (0 or >1 is a critical failure).
4. All 4 option items have non-empty `content_markdown`.
5. `status` is not set to `"withdrawn"`.

---

## 3. KaTeX Formula Formatting & Sanitization

Cambridge papers frequently contain financial figures, mathematical formulae, Greek variables, and fractions. Malformed math syntax breaks client-side rendering.

### 3.1. The Dollar Sign Rule: Currency vs KaTeX Delimiters
- **Inline Math Delimiter**: Single unescaped `$...$` (e.g., `$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$`).
- **Display Math Block**: Double dollar signs `$$...$$` on dedicated lines.
- **Currency Symbols**: ALWAYS escape literal dollar amounts with a backslash: `\$100`, `\$2.50`, `\$50 million`.
  - *Failure mode*: Writing `$50 to $100` accidentally triggers KaTeX parser on `50 to `, corrupting text and breaking KaTeX compilation.

### 3.2. Common Cambridge Formula Templates

| Concept | Raw LaTeX | Rendered Output |
| :--- | :--- | :--- |
| **Elasticity of Demand** | `PED = \frac{\% \Delta QD}{\% \Delta P}` | \(\text{PED} = \frac{\% \Delta QD}{\% \Delta P}\) |
| **Index / Subscript** | `Q_1 \rightarrow Q_2` | \(Q_1 \rightarrow Q_2\) |
| **Average Fixed Cost** | `AFC = \frac{TFC}{Q}` | \(\text{AFC} = \frac{\text{TFC}}{Q}\) |
| **Percentage Change** | `\frac{New - Old}{Old} \times 100\%` | \(\frac{\text{New} - \text{Old}}{\text{Old}} \times 100\%\) |

### 3.3. Automated Sanitization (`lib/ingestion/katexSanitizer.ts`)
Run `sanitizeKaTeX(text)` before saving or publishing:
- Converts unescaped raw currency figures (`$100`) to `\$100`.
- Standardizes letter `x` between numbers into `\times` (e.g. `10 x 5` → `10 \times 5`).
- Fixes unbalanced `{` and `}` braces in math mode.

---

## 4. Diagram Extraction & Asset Storage

Many Cambridge economics questions depend on demand & supply shifts, Production Possibility Curves (PPC), circular flow models, or balance of payments tables.

### 4.1. Extraction Specifications
- **Format**: PNG or WebP with transparent/white background.
- **Cropping**: Tight bounding box around the axis labels, curves, and keys without cutting off text labels or question numbers.
- **Diagram Object Definition**:
  ```json
  "diagram": {
    "has_diagram": true,
    "image_url": "https://[project-id].supabase.co/storage/v1/object/public/question-diagrams/0455_s24_12_q4.webp",
    "storage_path": "0455_s24_12/q4.webp",
    "alt_description": "Supply and demand curve showing a rightward shift of supply from S1 to S2 with equilibrium price falling from P1 to P2"
  }
  ```
- **Supabase Storage Bucket**: `question-diagrams`. Public read access enabled.

---

## 5. UI/UX Standards & Interaction Protocols

The Ingestion Studio enforces Revizz's **3D neobrutalist** design language with high accessibility and rapid review velocity.

### 5.1. 2-Column Focus Layout
- **Left Navigation Column (`w-full lg:w-[22%] min-w-[240px] max-w-[320px]`)**:
  - Contains searchable question matrix, live validity count, filter chips (`All`, `Valid`, `Review`, `Diagrams`).
- **Main Authoring Workspace (`flex-1 min-w-0`)**:
  - Full-width focus area hosting `IngestionStemEditor`, `IngestionOptionsEditor`, and `IngestionMediaPanel`.
  - When the preview drawer is opened on desktop (≥ 1536px), the workspace smoothly contracts using `2xl:mr-[550px]`.

### 5.2. Slide-Over Preview Drawer
- **Dimensions**: `fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[500px] xl:w-[540px]`.
- **Content**: Mounts `IngestionLivePreview` (interactive student Gameboy simulator) and `IngestionDiagnostics` (7-point QA test suite).
- **Dismissal**: Closes on `Escape` key, backdrop click, or `[X]` button.

### 5.3. Button Fatigue Reduction
- **Header Actions**: Reduced from 7 buttons to **two primary buttons**:
  - `[👁 Preview]` (Teal `#14B8A6` toggle)
  - `[Push Live]` (Green `#22C55E` action)
- **Overflow Dropdown `[···]`**: Houses all auxiliary tools (Presets, Upload JSON, Payload inspect, Settings, Audit drawer).
- **Health Indicator**: Clean circular traffic light badge:
  - Green (`#22C55E`): ≥ 90% valid
  - Yellow (`#FACC15`): 50%–89% valid
  - Coral (`#FB7185`): < 50% valid

### 5.4. Progressive Disclosure Accordions
In `IngestionMediaPanel.tsx`:
- **Diagram Accordion**: Defaults to **collapsed** if `has_diagram: false` to eliminate whitespace clutter. Auto-expands when a diagram image is loaded.
- **Syllabus & Derivation Accordion**: Defaults to **expanded** with tabbed views (`Split`, `Edit`, `Preview`).

### 5.5. Rapid Keyboard Navigation
When cursor focus is outside an `<input>` or `<textarea>`:
- `1` or `A`: Set correct answer to **A**.
- `2` or `B`: Set correct answer to **B**.
- `3` or `C`: Set correct answer to **C**.
- `4` or `D`: Set correct answer to **D**.
- `ArrowUp` / `ArrowLeft`: Navigate to previous question.
- `ArrowDown` / `ArrowRight`: Navigate to next question.
- `Home` / `End`: Jump to first / last question.
- `Escape`: Close active modal, drawer, or lightbox.

---

## 6. Supabase Publishing & Database Schema

Publishing is triggered via the **`[Push Live]`** button or the API route `POST /api/ingest/publish-paper`.

### Database Entities & Relations
```
subjects (id, code, name, icon)
    │
    ▼
papers (id, subject_id, year, series, paper_code)
    │
    ├───────────────────────────┐
    ▼                           ▼
topics (id, paper_id, name)    questions (id, paper_id, topic_id, question_number, stem, options, diagram, explanation)
```

### Atomic Publishing Steps
1. **Schema Check**: Pre-publish validation checks all questions using `validateStagingPaper`.
2. **Subject Upsert**: Upserts subject code (e.g., `0455`).
3. **Paper Upsert**: Upserts paper unique composite (`0455`, `2024`, `s`, `12`).
4. **Topics Upsert**: Synchronizes syllabus topics and extracts foreign key IDs.
5. **Questions Batch Upsert**: Writes questions atomically into `questions` table with JSONB options payload:
   ```json
   [
     { "id": "A", "text_markdown": "...", "is_correct": true },
     { "id": "B", "text_markdown": "...", "is_correct": false },
     { "id": "C", "text_markdown": "...", "is_correct": false },
     { "id": "D", "text_markdown": "...", "is_correct": false }
   ]
   ```

---

## 7. Verification & Testing Commands

Always run the verification suites before submitting ingestion changes:

```bash
# 1. Navigation, validation rules, and diagram format verification
npx tsx scripts/verify-ingestion-nav.ts

# 2. Comprehensive scoring, mastery, auth, and QA verification suite
npm test
```
