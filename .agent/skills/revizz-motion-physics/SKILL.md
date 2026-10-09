---
name: revizz-motion-physics
description: Motion design and Framer Motion spring physics specifications for Revizz.
---

# Revizz Motion Design & Spring Physics

This skill defines the animation curves, physics parameters, and timing specifications for **Revizz**. Revizz uses tactile, physical spring dynamics that feel rewarding and punchy like an arcade machine, while respecting user cognitive load and accessibility preferences.

---

## 1. Physics Presets & Spring Constants

Revizz avoids linear or static cubic-bezier easing in favor of **natural spring physics**. Springs eliminate unnatural robotic deceleration and provide organic tactile feedback.

### Core Spring Token Profiles

| Profile Name | Stiffness | Damping | Mass | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Card Entry** | `350` | `24` | `0.8` | New question card sliding into view (`y: 18 -> 0`, `scale: 0.96 -> 1`) |
| **XP Punch** | `450` | `18` | `0.6` | XP badge pulsing when points are earned (`scale: 1.15 -> 1`) |
| **Streak Flame** | `400` | `20` | `0.7` | Streak fire pill popping into the header upon reaching 3+ streak |
| **Option Press** | `500` | `22` | `0.5` | Tactile depression and bounce back on button tap |
| **Modal Pop** | `380` | `25` | `1.0` | Dialog/drawer entrance and exit |

### Framer Motion Preset Objects

```tsx
export const SPRINGS = {
  cardEntry: {
    type: "spring",
    stiffness: 380,
    damping: 24,
    mass: 0.8,
  },
  xpPunch: {
    type: "spring",
    stiffness: 450,
    damping: 18,
    mass: 0.6,
  },
  streakPop: {
    type: "spring",
    stiffness: 420,
    damping: 20,
    mass: 0.7,
  },
  shakeMistake: {
    type: "spring",
    stiffness: 600,
    damping: 15,
  },
} as const;
```

---

## 2. Component Animation Recipes

### A. Question Card Entrance
Every new question enters with a slight upward spring translation, feeling tossed onto the virtual desk:

```tsx
<motion.div
  key={`card-${question.id}`}
  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={SPRINGS.cardEntry}
  className="w-full bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-6 mb-4 sm:mb-6 shadow-chunky"
>
  {/* Question Stem */}
</motion.div>
```

### B. XP Increment Pulse
When XP increments, pulse the badge scale using a unique key trigger:

```tsx
<motion.div
  key={`xp-${totalXP}`}
  initial={shouldReduceMotion ? false : { scale: 1.18 }}
  animate={{ scale: 1 }}
  transition={SPRINGS.xpPunch}
  className="bg-brand-indigo text-white px-3 py-1.5 rounded-full font-black text-sm"
>
  {totalXP} XP
</motion.div>
```

### C. Streak Fire Emergence
When a student hits 3 or more consecutive correct answers:

```tsx
{currentStreak >= 3 && (
  <motion.div
    initial={shouldReduceMotion ? { scale: 1 } : { scale: 0.7, y: -4 }}
    animate={{ scale: 1, y: 0 }}
    transition={SPRINGS.streakPop}
    className="bg-amber-100 text-amber-900 px-3 py-1.5 rounded-full font-black text-xs sm:text-sm border border-amber-300 flex items-center gap-1"
  >
    🔥 {currentStreak}
  </motion.div>
)}
```

---

## 3. Shake Physics for Mistakes & First-Wrong Retries

When a student selects an incorrect option on their first attempt, give immediate physical feedback via an elastic horizontal shake before disabling the distractor.

### Keyframe Shake Specification
Revizz configures a custom keyframe shake in Tailwind:

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}
```

### Motion Implementation on Mistake
Apply the shake conditionally to the selected wrong option:

```tsx
<motion.button
  animate={
    isMistake && !shouldReduceMotion
      ? { x: [0, -6, 6, -5, 5, -2, 2, 0] }
      : { x: 0 }
  }
  transition={{ duration: 0.45, ease: "easeInOut" }}
  className={getOptionStyle(opt.id)}
  onClick={() => onAnswer(opt.id)}
>
  {/* Option Content */}
</motion.button>
```

---

## 4. Non-Blocking Celebration Timing

Celebrations (confetti bursts, sound effects, level-up banners) must **never freeze the gameplay loop**.

### Timing Constraints
- **Zero Input Lock**: Never disable the "Next" button or delay interactivity to wait for an animation to complete.
- **Maximum Micro-Delay**: If an automated transition is configured, the transition delay must not exceed **350ms - 400ms**.
- **Confetti Engine**: Run canvas confetti in a non-blocking background layer:
  - Trigger via `requestAnimationFrame`.
  - Garbage-collect particle arrays promptly.
  - Never mount heavyweight DOM confetti elements that trigger layout recalculation.

```tsx
// Fire non-blocking celebration without halting state
export function triggerCelebrationBurst() {
  if (typeof window === 'undefined') return;
  // Non-blocking canvas confetti call
  canvasConfetti({
    particleCount: 40,
    spread: 60,
    origin: { y: 0.8 },
    disableForReducedMotion: true,
  });
}
```

---

## 5. Prefers-Reduced-Motion Fallbacks

Users with vestibular disorders or motion sensitivities must have motion eliminated without breaking visual clarity.

### Implementation Protocol

1. **Always query `useReducedMotion()`**:
   ```tsx
   import { useReducedMotion } from 'framer-motion';

   export function QuestionCard(...) {
     const shouldReduceMotion = useReducedMotion();
     // ...
   }
   ```

2. **Strict Fallback Rules**:
   - **Translations (`x`, `y`)**: Replace with simple opacity fade (`initial={{ opacity: 0 }}` -> `animate={{ opacity: 1 }}`).
   - **Scale Pulses**: Disable scale (`scale: 1`).
   - **Keyframe Shakes**: Never shake or vibrate elements; indicate mistake solely through static visual changes (red tint, strike-through, badge).
   - **Continuous Animations**: Disable CSS animations like `animate-bounce` or `animate-pulse` by checking the reduced-motion media query:
     ```css
     @media (prefers-reduced-motion: reduce) {
       *, ::before, ::after {
         animation-duration: 0.01ms !important;
         animation-iteration-count: 1 !important;
         transition-duration: 0.01ms !important;
       }
     }
     ```

---

## 6. Motion Anti-Patterns to Avoid

❌ **Never use slow, floating easing curves** (`ease-in-out` with durations > 500ms) for quiz UI — it feels sluggish and frustrating.  
❌ **Never block user clicks while a card is entering** — pointer events must remain active.  
❌ **Never trigger layout reflows during animations** — animate only GPU-accelerated properties: `transform` (`x`, `y`, `scale`) and `opacity`.  
❌ **Never stack multiple conflicting spring animations** on parent and child simultaneously.
