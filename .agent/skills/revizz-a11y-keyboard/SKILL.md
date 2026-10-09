---
name: revizz-a11y-keyboard
description: Standards for keyboard accessibility, hotkeys (1-4, A-D, Space/Enter), ARIA live regions, and WCAG 2.1 AA compliance.
---

# Revizz Keyboard Accessibility & A11y Standards

This skill governs all accessibility, keyboard navigation, screen reader semantics, and WCAG 2.1 AA standards for **Revizz**. Students and educators must be able to complete quizzes seamlessly using only a keyboard or assistive technology.

---

## 1. Hotkey Map & Keyboard Shortcuts

Revizz supports rapid desktop gameplay via standardized hotkeys.

### Shortcut Table

| Key Binding | Target Action | Active Condition |
| :--- | :--- | :--- |
| `1` or `A` / `a` | Select Option A (Index 0) | Question in `unanswered` or `first-wrong` state |
| `2` or `B` / `b` | Select Option B (Index 1) | Question in `unanswered` or `first-wrong` state |
| `3` or `C` / `c` | Select Option C (Index 2) | Question in `unanswered` or `first-wrong` state |
| `4` or `D` / `d` | Select Option D (Index 3) | Question in `unanswered` or `first-wrong` state |
| `Space` or `Enter` | Proceed to Next Question / Finish | When answer has been submitted (`answered` / `timeout`) |
| `R` or `r` | Retry mistake (when available) | When `first-wrong` state permits retry |
| `Escape` | Close Dialog / Dismiss Modal | Any active dialog, modal, or drawer |

### Keyboard Event Listener Implementation Pattern

When listening to global keyboard events, implement strict guards to avoid capturing keystrokes when the user is typing in forms, search bars, or feedback inputs:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 1. Guard against text input interactions
    const target = e.target as HTMLElement | null;
    const isInput = 
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable;
    
    if (isInput) return;

    // 2. Prevent hotkeys if modal/dialog is open
    if (isModalOpen) return;

    // 3. Option Selection Hotkeys (1-4, A-D)
    const key = e.key.toUpperCase();
    const keyIndexMap: Record<string, number> = {
      '1': 0, 'A': 0,
      '2': 1, 'B': 1,
      '3': 2, 'C': 2,
      '4': 3, 'D': 3,
    };

    if (key in keyIndexMap && (status === 'unanswered' || status === 'first-wrong')) {
      const idx = keyIndexMap[key];
      const option = question.options[idx];
      // Do not allow re-selecting the previously disabled first-wrong option
      if (option && option.id !== firstWrongOptionId) {
        e.preventDefault();
        onAnswer(option.id);
      }
      return;
    }

    // 4. Space / Enter for Next question
    if ((e.key === 'Enter' || e.key === ' ') && (status === 'answered' || status === 'timeout')) {
      // Prevent double trigger if activeElement is currently a button
      if (target?.tagName === 'BUTTON') return;
      e.preventDefault();
      onNext();
      return;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [status, question, firstWrongOptionId, isModalOpen, onAnswer, onNext]);
```

---

## 2. Focus Management & Visible Focus Indicators

Tactile buttons have chunky bottom borders. Standard browser focus outlines can clash or get obscured. Use custom high-contrast focus rings tailored to the neobrutalist aesthetic.

### Focus Ring Guidelines
- Always use `:focus-visible` rather than `:focus` so mouse clicks do not leave lingering rings.
- Use a distinct 3px-4px offset ring that frames both the card and its chunky 3D bottom border:
  ```tsx
  className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50"
  ```
- Retain keyboard tab order:
  1. Header controls (Sound toggle, Leaderboard)
  2. Question stem (focusable only if scrollable)
  3. Option cards in sequential order (Option A -> B -> C -> D)
  4. Bottom action button ("Next Question", "Finish Early")

---

## 3. ARIA Live Regions & Screen Reader Announcements

Quiz games are dynamic. Visual state changes (timer counting down, score popups, streaks) must be communicated non-visually without drowning the user in audio noise.

### Announcement Guidelines

1. **Answer Results & Feedback**:
   - Use `aria-live="polite"` for regular feedback and `aria-live="assertive"` for timeouts.
   - Example:
     ```tsx
     <div className="sr-only" aria-live="polite" aria-atomic="true">
       {status === 'answered' && isCorrect && (
         `Correct! You gained ${xpAwarded} XP. Current streak: ${currentStreak}.`
       )}
       {status === 'first-wrong' && (
         "Incorrect. Try once more for half XP!"
       )}
       {status === 'timeout' && (
         "Time is up! Question marked incorrect."
       )}
     </div>
     ```

2. **Timer Announcements**:
   - **Do not** announce every second—that overwhelms screen readers.
   - Announce only critical thresholds: at 30 seconds, 15 seconds, and 5 seconds remaining.
   ```tsx
   <div className="sr-only" aria-live="assertive">
     {timeLeft === 15 && "Warning: 15 seconds remaining."}
     {timeLeft === 5 && "5 seconds remaining."}
   </div>
   ```

3. **Accessible Option Card Semantics**:
   - Wrap options in a semantic `role="radiogroup"` or deliver them as semantic `<button>` elements with clear `aria-label` or `aria-describedby`:
   ```tsx
   <button
     type="button"
     role="radio"
     aria-checked={isSelected}
     aria-disabled={isDisabled}
     disabled={isDisabled}
     aria-label={`Option ${letter}: ${stripMarkdown(option.text)}`}
     className={getOptionStyle(option.id)}
     onClick={() => onAnswer(option.id)}
   >
     {/* Visual content */}
   </button>
   ```

---

## 4. WCAG 2.1 AA Compliance Checklist

### Contrast Ratios (Minimum 4.5:1 for Text, 3:1 for UI Controls)
- `slate-800` (`#1E293B`) text on `white` or `amber-50/60` background: **> 12:1** (Passes AAA).
- `emerald-950` text on `emerald-50` background: **> 9:1** (Passes AAA).
- `rose-950` text on `rose-50` background: **> 9:1** (Passes AAA).
- `brand-indigo` (`#6366F1`) badges must use white text (`#FFFFFF`): **4.6:1** (Passes AA).
- Interactive borders (`border-slate-300`, `border-slate-800`): **> 3:1** against backgrounds.

### Target Size & Spacing
- Every tap and click target must have a minimum interactive bounding box of **44 × 44px**.
- Option buttons must have a minimum height of `min-h-[56px]`.
- Maintain a minimum spacing of `8px` (`mb-3` or `gap-2`) between adjacent selectable cards to prevent accidental mis-taps.

### Non-Reliance on Color Alone
- Never communicate correctness solely through green or red backgrounds.
- Always combine color with:
  1. **Textual badge or status**: e.g., "Correct", "Incorrect", "Retry"
  2. **Iconographic indicators**: Checkmark (✓) for correct, cross (✕) or disabled slash for incorrect
  3. **Audio cues**: Distinct ascending bell for correct, low buzz for incorrect

---

## 5. A11y Anti-Patterns to Avoid

❌ **Never use unlabelled `div` with `onClick`** — always use native `<button>` or provide `role="button"` and `tabIndex={0}` with onKeyDown.  
❌ **Never trap focus inside unescapable components** — always allow standard tab cycling.  
❌ **Never suppress `:focus-visible` without a custom replacement** (`outline-none` without `ring-*` is prohibited).  
❌ **Never stream markdown or raw LaTeX to screen readers** — provide sanitized `aria-label` text for formulas (e.g. `aria-label="f of x equals x squared"`).  
❌ **Never trigger auto-advance without giving users time to absorb feedback** — allow students to read explanations before pressing Next.
