---
name: revizz-webperf
description: "Core Web Vitals optimization guidelines for Revizz: zero CLS KaTeX formulas, 0ms touch delay, and asset preloading."
---

# Revizz Core Web Vitals & Performance Engineering

This skill defines the performance budgets, rendering optimizations, and Core Web Vitals (CWV) strategies for **Revizz**. Gamified educational applications require instant tactile response (INP < 50ms) and zero visual jumps (CLS = 0) even on constrained mobile networks.

---

## 1. Zero CLS: KaTeX Mathematical Rendering & Stem Containment

Mathematics and chemical equations are central to Revizz questions. If KaTeX formulas render asynchronously or without font files in cache, text reflow causes severe Cumulative Layout Shift (CLS), jarring the student's gaze and causing accidental mis-clicks.

### A. Stem Height Containment
Always reserve vertical space for question stems so options do not jump up and down between questions:

```tsx
// Question Stem Container with Content Containment
<div className="min-h-[110px] sm:min-h-[120px] flex flex-col justify-center mb-5 sm:mb-6">
  <div className="text-lg sm:text-xl font-bold text-slate-800 leading-snug overflow-x-auto break-words [contain-intrinsic-size:120px]">
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {question.stem}
    </ReactMarkdown>
  </div>
</div>
```

### B. KaTeX CSS & Font Preloading
1. Ensure `katex/dist/katex.min.css` is bundled statically in the app bundle or imported once at the root or component level:
   ```tsx
   import 'katex/dist/katex.min.css';
   ```
2. In `app/layout.tsx`, preload primary KaTeX `.woff2` font files to eliminate FOIT (Flash of Invisible Text) and FOUT:
   ```html
   <link
     rel="preload"
     href="/fonts/KaTeX_Main-Regular.woff2"
     as="font"
     type="font/woff2"
     crossorigin="anonymous"
   />
   <link
     rel="preload"
     href="/fonts/KaTeX_Math-Italic.woff2"
     as="font"
     type="font/woff2"
     crossorigin="anonymous"
   />
   ```
3. Use `overflow-x-auto` on formula containers to prevent wide equations (e.g. matrices, long chemical equations) from forcing horizontal document scrollbars.

---

## 2. 0ms Touch Delay & Ultra-Fast INP (< 50ms)

Mobile browsers by default introduce a ~300ms delay on tap events to detect potential double-tap-to-zoom gestures. In a fast-paced quiz, 300ms makes button presses feel broken and laggy.

### A. Global Touch Action Manipulation
Add `touch-action: manipulation` to all interactive buttons, cards, and pills to eliminate the 300ms touch delay:

```css
/* app/globals.css */
button,
[role="button"],
.interactive-card {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

### B. Non-Blocking Event Handlers
- Never perform heavy computations, synchronous database writes, or localStorage serialization inside the immediate `onClick` handler.
- Dispatch state immediately to update the button color, and defer secondary side effects (audio playback, analytics dispatch, persistence) using microtasks:
```tsx
const handleSelect = (optionId: string) => {
  // 1. Immediate synchronous UI response (< 16ms)
  setSelectedOptionId(optionId);
  setStatus(evalAnswer(optionId));

  // 2. Non-blocking audio feedback
  queueMicrotask(() => {
    playSound(isCorrect ? 'correct' : 'wrong');
  });

  // 3. Deferred analytics / storage persistence
  setTimeout(() => {
    persistQuizProgress(quizState);
  }, 0);
};
```

---

## 3. Asset & Sound Synthesis Architecture

Revizz uses an instant-load sound architecture. Instead of streaming heavyweight MP3/WAV files that can fail on flaky cellular connections, Revizz uses **Web Audio API synthesis**:

### Zero-Asset Web Audio API Synthesis (`lib/audio.ts`)
```tsx
// Synthesized tones load in 0ms and consume 0KB network bandwidth
class SoundManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  playCorrectSound() {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }
}
```

---

## 4. Mobile Viewport & Screen Geometry Optimization

Mobile browsers have dynamic UI elements (address bars, navigation docks) that trigger viewport height resizing.

### Viewport Height Rules
- **Use `dvh` units** instead of `vh` to prevent sudden jumps when mobile Safari or Chrome scrolls:
  ```tsx
  className="min-h-screen md:min-h-[85vh] min-h-[100dvh]"
  ```
- **Safe Area Insets**:
  Ensure bottom action bars and sticky controls respect the notch and home bar:
  ```css
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  ```
- **Bottom Clearance**: Maintain `pb-28 sm:pb-6` on main quiz card wrappers so floating navigation bars never obscure the 4th option button.

---

## 5. Performance Budget Checklist

| Metric | Target | Verification Method |
| :--- | :--- | :--- |
| **CLS (Cumulative Layout Shift)** | `< 0.02` (Zero shift) | Chrome DevTools Performance / Lighthouse |
| **INP (Interaction to Next Paint)** | `< 50ms` | Performance Timeline `onpointerdown` -> frame render |
| **LCP (Largest Contentful Paint)** | `< 1.2s` | Web Vitals report |
| **Sound Playback Latency** | `< 20ms` | Web Audio API AudioContext hardware clock |
| **Bundle Size Impact (KaTeX)** | Split dynamically or preloaded | `@next/bundle-analyzer` |

---

## 6. Performance Anti-Patterns to Avoid

❌ **Never fetch remote fonts inside client components** — always preload in layout head or configure `next/font`.  
❌ **Never load external MP3 files synchronously on click** — audio files can buffer or fail on low bandwidth; use Web Audio API synthesizers.  
❌ **Never leave formulas without overflow containment** — an unconstrained KaTeX table will widen the entire document body.  
❌ **Never rely on `100vh` on mobile web** — it causes layout jitter when the browser address bar collapses.
