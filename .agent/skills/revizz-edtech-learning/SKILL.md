---
name: revizz-edtech-learning
description: Cognitive learning science, Leitner spaced repetition review pile algorithms, and Cambridge distractor analytics.
---

# Revizz EdTech Learning Science & Pedagogical Architecture

This skill defines the pedagogical mechanics, spaced repetition algorithms, scoring psychology, and educator analytics for **Revizz**. Revizz turns repetitive multiple-choice practice into an effective, low-anxiety retrieval practice engine grounded in cognitive learning science.

---

## 1. Learning Science Foundations

Revizz is engineered around three validated principles of cognitive science:

1. **Retrieval Practice (The Testing Effect)**:
   Actively recalling an answer from memory produces stronger and longer-lasting retention than passively re-reading notes or textbooks.
2. **Immediate Formative Feedback & Error Correction**:
   Delayed feedback allows students to mentally solidify misconceptions. Providing instant feedback paired with a second chance encourages active error diagnosis.
3. **Low-Stakes Gamification**:
   High-stakes failure breeds math/science anxiety. Revizz removes penalties for exploration by offering half-XP recovery on second attempts, keeping students in a growth-mindset flow state.

---

## 2. The 2-Try Loop & Half-XP Retry Incentive

Traditional quizzes punish mistakes with immediate failure, causing disengagement. Revizz employs a **2-try mastery loop**:

```
[ Question Presented ]
          │
          ▼
   [ First Attempt ]
     ├── Correct ──► Award Base XP × Streak Multiplier (10, 12, or 15 XP)
     │               Increment Streak 🔥
     │               Mark Question Mastered
     │
     └── Mistake ──► Reset Streak to 0
                     Disable Selected Distractor
                     Play Mistake Vibration/Tone
                     Enqueue into Spaced Review Pile
                     │
                     ▼
             [ Second Attempt (Retry) ]
               ├── Correct ──► Award Half XP (5 XP)
               │               Encourages perseverance
               │               Remains in Review Pile for future consolidation
               │
               └── Mistake ──► Award 0 XP
                               Reveal Correct Answer & Step-by-Step Explanation
                               Locked into Review Pile
```

### Mathematical Scoring Specification (`lib/scoring.ts`)

| Scenario | Streak Action | Multiplier | XP Awarded | Review Pile Status |
| :--- | :--- | :--- | :--- | :--- |
| **1st Try Correct (Streak 0-2)** | Streak + 1 | `1.0x` | `10 XP` | Removed from pile if mastered |
| **1st Try Correct (Streak 3-4)** | Streak + 1 | `1.2x` | `12 XP` | Removed from pile if mastered |
| **1st Try Correct (Streak 5+)** | Streak + 1 | `1.5x` | `15 XP` | Removed from pile if mastered |
| **1st Try Mistake** | Streak = 0 | `1.0x` | `0 XP` | Enqueued into Review Pile |
| **2nd Try (Retry) Correct** | Streak = 0 | `1.0x` | `5 XP` (50%) | Kept in Review Pile for re-test |
| **2nd Try Mistake / Timeout** | Streak = 0 | `1.0x` | `0 XP` | Kept in Review Pile |

---

## 3. Leitner Spaced Repetition & The Review Pile

Revizz adapts the classic Leitner flashcard box algorithm for modern MCQ practice.

### The Mastery Progression Tiers (`lib/mastery.ts`)
- **🌱 Novice Tier (< 50% Mastery)**:
  Student struggles with foundational concepts. Questions repeat frequently in short cycles.
- **⚡ Proficient Tier (50% - 80% Mastery)**:
  Student understands core principles but makes occasional calculation or edge-case errors.
- **👑 Master Tier (> 80% Mastery)**:
  Student demonstrates high automaticity and accuracy on first-try attempts.

### Review Pile Graduation Rule
A question only graduates out of the student's active Review Pile when answered **correctly on the first attempt** in a subsequent study session:

```tsx
export function recordQuestionOutcome(
  questionId: string,
  firstTryCorrect: boolean
) {
  const pile = getReviewPile();
  
  if (firstTryCorrect) {
    // If answered correctly on first try, remove from review pile
    delete pile[questionId];
    recordFirstTrySuccess(questionId);
  } else {
    // Increment mistake counter and update timestamp
    const entry = pile[questionId] || { mistakeCount: 0, lastMistakeAt: Date.now() };
    entry.mistakeCount += 1;
    entry.lastMistakeAt = Date.now();
    pile[questionId] = entry;
  }
  
  saveReviewPile(pile);
}
```

### Guest to Authenticated Synchronization
- Guest users persist review pile state in `localStorage` under `revizz_guest_review_pile`.
- Upon student sign-in, the sync engine merges local review pile entries with the student's cloud profile in Supabase (`lib/sync.ts`).

---

## 4. Cambridge Distractor Analytics & Misconception Tracking

In high-quality examination boards (such as Cambridge IGCSE / A-Levels), multiple-choice distractors are never arbitrary numbers. Each distractor represents a **specific diagnostic cognitive error**:

- **Distractor A**: Sign error or algebraic transposition mistake.
- **Distractor B**: Inverted relationship (e.g. multiplying by resistance instead of dividing).
- **Distractor C**: Omission of standard unit conversion (e.g. centimeters to meters).
- **Option D (Key)**: Mathematically sound derivation.

### Diagnostic Attempt Schema
Revizz logs granular attempt telemetry for teacher cohort analysis:

```typescript
export interface AttemptTelemetry {
  attempt_id: string;
  user_id: string | null;
  question_id: string;
  topic_id: string;
  selected_option_id: string;
  is_correct: boolean;
  is_first_try: boolean;
  time_spent_ms: number;
  distractor_code?: string; // e.g. "MISCONCEPTION_UNIT_CONVERSION"
  created_at: string;
}
```

### Teacher Cohort Misconception Aggregation
The Educator Portal (`/portal`) aggregates distractor selections across class cohorts:

1. **Misconception Heatmap**:
   If 45% of students pick Distractor B, the educator dashboard flags:  
   `⚠️ High Misconception Rate: 45% of students confused V=IR with I=VR in Topic: Electric Circuits.`
2. **Distractor Distribution Balance**:
   Validates questions to ensure correct answers are evenly distributed across A, B, C, D (avoiding test-taker letter bias).
3. **Targeted Review Round Generation**:
   Teachers can click "Launch Misconception Drill" to generate a custom 5-question round composed exclusively of their cohort's top 3 missed concepts.

---

## 5. EdTech Pedagogical Anti-Patterns to Avoid

❌ **Never reveal the correct answer immediately after the first mistake** — always allow the student to attempt recovery to stimulate cognitive retrieval.  
❌ **Never wipe review pile items after a single second-try success** — second-try successes only prove guided elimination, not unassisted mastery.  
❌ **Never punish students with negative XP** — negative scores induce test anxiety and app abandonment.  
❌ **Never write dummy or trick distractors** (e.g. "None of the above" or nonsensical jokes) — distractors must be plausible misconceptions with diagnostic value.
