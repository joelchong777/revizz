---
name: revizz-ui-ux
description: Design guidelines for Revizz's playful, tactile 3D neobrutalist aesthetic, color palette tokens, button physics, and multi-device container rules.
---

# Revizz UI/UX Design System

This skill defines the visual identity, token architecture, tactile physics, and layout constraints for **Revizz**. Revizz uses a high-contrast, tactile, **3D neobrutalist** visual language that feels playful, gamified, and responsive like a physical mechanical toy while preserving clean accessibility.

---

## 1. Core Color Palette Tokens

Revizz uses a deliberate, high-energy palette built on Tailwind CSS tokens (`brand.*` and calibrated Tailwind slate/amber foundations).

### Color Tokens & Hex Values

| Token Name | Hex Code | Purpose & Semantic Role |
| :--- | :--- | :--- |
| `brand.yellow` | `#FACC15` | Hero accent, primary CTA highlight, warning/accent badges (`dark: #CA8A04`, `light: #FEF08A`) |
| `brand.teal` | `#14B8A6` | Primary brand accent, timer active state, navigation progress (`dark: #0F766E`, `light: #99F6E4`) |
| `brand.coral` | `#FB7185` | Urgent timer warning (<15s), mistake feedback, high-energy accents (`dark: #E11D48`, `light: #FECDD3`) |
| `brand.indigo` | `#6366F1` | XP counter, streak indicators, primary actions (`dark: #4338CA`, `light: #C7D2FE`) |
| `brand.green` | `#22C55E` | Correct answer selection, master tier badge, success validation (`dark: #15803D`, `light: #BBF7D0`) |
| `brand.amber` | `#F59E0B` | Streak fire flames, gold mastery medals, caution chips (`dark: #D97706`, `light: #FDE68A`) |
| `slate-800` | `#1E293B` | Neobrutalist border outlines, primary headings, chunky container borders |
| `amber-50/60` | `#FFFDF7` | Soft parchment background wash to reduce glare during long quiz sessions |

### Tailwind Extension Reference
Ensure all components consume tokens via Tailwind configuration:
```tsx
// tailwind.config.ts extension mapping:
colors: {
  brand: {
    yellow: { DEFAULT: "#FACC15", light: "#FEF08A", dark: "#CA8A04" },
    teal:   { DEFAULT: "#14B8A6", light: "#99F6E4", dark: "#0F766E" },
    coral:  { DEFAULT: "#FB7185", light: "#FECDD3", dark: "#E11D48" },
    indigo: { DEFAULT: "#6366F1", light: "#C7D2FE", dark: "#4338CA" },
    green:  { DEFAULT: "#22C55E", light: "#BBF7D0", dark: "#15803D" },
    amber:  { DEFAULT: "#F59E0B", light: "#FDE68A", dark: "#D97706" },
  }
}
```

---

## 2. Chunky Border Rules & Tactile 3D Button Physics

Revizz controls tactile button feel through **asymmetric border bottoms** (`border-2 border-b-4`) and custom box shadows. This creates an authentic 3D mechanical push-button depression effect without relying on heavy skeuomorphic gradients.

### The Tactile Button Formula

```tsx
// Standard Interactive Option Card Formula:
const buttonClass = `
  w-full min-h-[56px] p-3.5 sm:p-4 text-left font-bold relative text-base sm:text-lg mb-3 sm:mb-3.5
  rounded-2xl border-2 border-b-4 border-slate-200 border-b-slate-300
  bg-white text-slate-800 shadow-chunky select-none
  transition-all duration-75 ease-out
  hover:border-slate-300 hover:bg-slate-50
  cursor-pointer
  active:translate-y-0.5 active:border-b-2 active:shadow-none
`;
```

### Shadow Tokens
- `shadow-chunky`: `0 4px 0 0 rgba(0, 0, 0, 0.1)`
- `shadow-chunky-lg`: `0 6px 0 0 rgba(0, 0, 0, 0.12)`
- `shadow-playful`: `0 8px 0 0 rgba(0, 0, 0, 0.06)`

### Press States & Mechanical Feel
1. **Rest State**: `border-2 border-b-4`, `shadow-chunky`, `translate-y-0`.
2. **Hover State**: Border shifts subtly darker (`border-slate-300`), slight background warm/cool tint (`hover:bg-slate-50`).
3. **Active/Press State**:
   - `active:translate-y-0.5` (physically depresses down 2px)
   - `active:border-b-2` (reduces bottom lip from 4px to 2px)
   - `active:shadow-none` (removes drop shadow to simulate button touching base plate)
4. **Transition Speed**: Use ultra-fast transitions (`duration-75` or `duration-100`) for press interactions to prevent sluggishness or rubbery latency.

### State-Specific Option Variations

| State | Border Styling | Background & Text | Feedback Cue |
| :--- | :--- | :--- | :--- |
| **Unanswered** | `border-slate-200 border-b-slate-300` | `bg-white text-slate-800` | Clickable, bouncy hover |
| **First Wrong** | `border-slate-300 border-b-slate-300` | `bg-slate-100 text-slate-400 opacity-50` | Greyed out, disabled, strike-through option |
| **Correct (Final)** | `border-emerald-500 border-b-emerald-700` | `bg-emerald-50 text-emerald-950` | Vibrant green highlight, badge checkmark |
| **Incorrect (Final)** | `border-rose-400 border-b-rose-600` | `bg-rose-50 text-rose-950 opacity-85` | Rose tint, clear distractor indicator |

---

## 3. Multi-Device Container Architecture

Revizz uses a dual-layout strategy: a **focused mobile-first framed canvas** for the student quiz experience, and an **unconstrained expansive dashboard** for educators.

### Desktop Framed Canvas vs. Fluid Mobile (`AppShell.tsx`)

```tsx
// Student Quiz Route ('/'):
<div className="w-full max-w-xl mx-auto md:my-8 md:p-6 md:rounded-3xl md:border-4 md:border-slate-800 md:shadow-[0_16px_0_0_rgba(15,23,42,0.15)] bg-amber-50/60 min-h-screen md:min-h-[85vh] flex flex-col px-3 sm:px-4">
  <Header />
  <main className="flex-1 flex flex-col">{children}</main>
</div>
```

### Layout Constraints by Form Factor

1. **Mobile (< 768px)**:
   - Full viewport width (`w-full`)
   - Edge-to-edge fluid container with comfortable side padding (`px-3 sm:px-4`)
   - Zero outer border or outer radius to maximize question stem and formula real estate
   - Bottom floating CTA bar with safe area padding (`pb-28 sm:pb-6`)
2. **Tablet & Desktop (>= 768px)**:
   - Centered framed gameboy/app card (`max-w-xl mx-auto md:my-8`)
   - Thick chunky border frame (`md:border-4 md:border-slate-800`)
   - High-elevation retro drop shadow (`md:shadow-[0_16px_0_0_rgba(15,23,42,0.15)]`)
   - Generous interior corner rounding (`md:rounded-3xl`)
3. **Educator Portal (`/portal/*`)**:
   - Completely bypasses the mobile-first quiz frame
   - Unconstrained full-width container (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`)
   - Multi-column tables, analytics cards, and cohort filters

---

## 4. Typography & Visual Hierarchy

- **Font Family**: Inter or clean system sans with tabular numbers enabled for scores and timers (`font-sans font-bold`).
- **Heading Scales**:
  - `h1`: `text-2xl sm:text-3xl font-black text-slate-900 tracking-tight`
  - Question Stem: `text-lg sm:text-xl font-bold text-slate-800 leading-snug`
  - Option Labels: `text-base sm:text-lg font-bold text-slate-800`
  - Badges & Chips: `text-xs sm:text-sm font-black uppercase tracking-wider`
- **Border Radii System**:
  - Small pills & chips: `rounded-full`
  - Interactive option cards: `rounded-2xl`
  - Question stem card & modals: `rounded-3xl`
  - Major shell containers: `rounded-4xl` (or `rounded-3xl` on desktop)

---

## 5. UI/UX Anti-Patterns to Avoid

❌ **Never use flat zero-depth borderless cards** — Revizz requires chunky 3D borders for tactile affordance.  
❌ **Never apply heavy drop shadows that obscure borders** — Shadows must be solid or crisp offset shadows (`shadow-chunky`), not fuzzy ambient blur.  
❌ **Never lock mobile views to desktop max-width containers** without removing outer borders — on mobile, screen real estate is precious.  
❌ **Never use harsh pure black (`#000000`) for backgrounds** — use `slate-800` or `slate-900` for outlines and borders, and `amber-50/60` for background wash.  
❌ **Never delay tap response** — all button clicks and option selections must react within 0ms.
