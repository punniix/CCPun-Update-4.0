---
name: CCPun Homepage
description: Personal financial advisory — Trusted · Premium · Personal
colors:
  deep-charcoal: "#251818"
  main-bg: "#352727"
  surface: "#4a3a3a"
  border-subtle: "#5b4848"
  warm-gold: "#e0c985"
  gold-bright: "#ebd9a2"
  gold-deep: "#d1b561"
  ink: "#faf9f9"
  ink-muted: "#baabab"
typography:
  display:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 300
    lineHeight: 1.6
  label:
    fontFamily: "Kanit, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "12px"
  md: "14px"
  lg: "16px"
  xl: "20px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "40px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.warm-gold}"
    textColor: "{colors.deep-charcoal}"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.gold-bright}"
    textColor: "{colors.deep-charcoal}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.warm-gold}"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  card-glass:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

# Design System: CCPun Homepage

## 1. Overview

**Creative North Star: "The Golden Compass"**

CCPun's visual language is built on one premise: a person of genuine expertise handing you a precision instrument — something that orients, clarifies, and earns trust through quality alone. The dark warm-charcoal surfaces create an intimate atmosphere, while the muted gold speaks of accumulated value rather than performative wealth. This is not a bank. This is a person.

The system is deliberately warm without being casual. Warmth is carried through temperature (the charcoal has a red-orange undertone, not cold grey), through typography (Kanit's humanist geometry reads Thai and Latin with equal dignity), and through controlled use of gold as a signal of care rather than luxury. Glass effects appear only where there is something to elevate — a button the user is about to press, a modal that deserves to float above the world.

What this system explicitly rejects: the cold institutional aesthetic of Thai state banks (SCB, Krungthai), the amateur clip-art energy of generic insurance agent sites, and the untouchable distance of luxury lifestyle brands. CCPun must feel like it was made by someone who knows your name.

**Key Characteristics:**
- Dark-warm, not dark-cold — charcoal surfaces carry red-orange undertone
- Gold as signal of care, not of wealth
- Glass reserved for interactive elevation, not decoration
- Kanit for all type: Thai/Latin parity at one typeface weight range
- CSS motion tokens in `components/layout/v5/motion-tokens.ts` and `V5.module.css` for purposeful transitions; the v5 root reduced-motion rule removes animation immediately.

## 2. Colors: The Compass Palette

Two poles define the system: deep warm charcoal at the base, muted gold at the signal layer. Every other token is a controlled step between them.

### Primary
- **Warm Gold** (`#e0c985`): The compass needle. Used exclusively on primary CTAs, active nav states, link hovers, and the single accent per section that earns the user's attention. Never used as a background for large areas.
- **Gold Bright** (`#ebd9a2`): Hover and highlighted state. Lighter, never heavier, than Warm Gold.
- **Gold Deep** (`#d1b561`): Pressed/active states and blockquote accents. Grounded, not glowing.

### Neutral
- **Ink** (`#faf9f9`): Primary text. Near-white with a faint warm undertone — not clinical white.
- **Ink Muted** (`#baabab`): Secondary text, captions, timestamps, helper copy. Must pass 4.5:1 against Surface.
- **Surface** (`#4a3a3a`): Card and elevated container background. Glass cards use this at 0.6 opacity.
- **Main Background** (`#352727`): The page canvas. Warm dark charcoal — the room the user inhabits.
- **Deep Charcoal** (`#251818`): Deepest background layer, scrollbar track, innermost nested containers.
- **Border Subtle** (`#5b4848`): All dividers and card outlines. Never used as a design accent.

### Named Rules
**The One Compass Rule.** Warm Gold appears on at most one primary CTA per viewport. It is a signal, not a decoration. If every button is gold, none of them are.

**The One LINE Element Rule** (owner decision 2026-10-25). Each page has exactly one LINE OA button: the floating chat dock, visible from page load (it sits above the cookie notice while that is open), which opens the topic panel with the page's prefill and campaign code. The header, hero, content and page endings carry no other LINE button or link; an article-body LINE CTA renders as an inline text link that opens the same panel. Because the dock is on every viewport, it is an outline control, so the One Compass Rule still leaves gold for the page's own primary action.

**The Temperature Rule.** Never introduce a neutral that trends toward cool grey or blue-grey. All neutrals — surface, bg, ink — must carry the red-orange hue of the charcoal base. Mixing in a cool neutral breaks the room.

## 3. Typography

**Display / Body Font:** Kanit (Thai-first, with system-ui fallback)
**No secondary typeface.** One family, weight contrast.

**Character:** Kanit at light (300) for body and bold (600–700) for headings creates a generous weight contrast without requiring a second face. The geometric structure reads as modern and precise; the Thai-native design ensures no visual downgrade when rendering Thai copy. The personality is confident without being aggressive.

### Hierarchy
- **Display** (700, clamp(2.5rem → 4rem), lh 1.1, ls -0.02em): Hero headlines only. One per page.
- **Headline** (600, clamp(1.75rem → 2.5rem), lh 1.2, ls -0.01em): Section titles. `text-wrap: balance` always applied.
- **Title** (500, 1.25rem, lh 1.4): Card headings, subsection labels, nav items.
- **Body** (300, 1rem, lh 1.6): All prose. Max line length 65–75ch. `text-wrap: pretty` for orphan control.
- **Label** (500, 0.875rem, lh 1.4): Button text, form labels, badges, metadata. Thai-first abbreviation conventions.

### Named Rules
**The One-Family Rule.** Kanit is the only typeface. Do not introduce a serif display face "for elegance" or a mono for code snippets unless the UI genuinely requires it. Weight contrast IS the hierarchy.

**The Thai-First Rule.** All copy renders in Thai by default. English terms appear only where there is no Thai equivalent. Never uppercase Thai text — it has no case.

## 4. Elevation

CCPun uses purposeful glass elevation. Surfaces are flat at rest; glass appears only when a layer genuinely floats above the content below it — navigation, modals, tooltips, active cards.

**The three layers:**
1. **Page canvas** (Main Background `#352727`) — flat, no shadow
2. **Content surface** (Surface `#4a3a3a`) — flat or with ambient glass shadow for cards
3. **Floating chrome** (glass at 0.6 opacity) — navbar, modals, interactive overlays

### Shadow Vocabulary
- **Glass ambient** (`0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`): Applied to glass-layer cards and panels. The inset highlight is the glass edge.
- **Gold glow** (`0 4px 24px rgba(197,160,89,0.4)`): Applied to primary CTA buttons in their default state. Signals the actionable layer.
- **Gold glow large** (`0 8px 32px rgba(197,160,89,0.5)`): Hover state for primary CTA. Never on static elements.

### Named Rules
**The Purposeful Glass Rule.** Glass is reserved for the interactive layer that floats above content. Do not apply backdrop-filter to section backgrounds, hero overlays, or decorative cards that are not interactive. Glass used decoratively dilutes the signal.

**The Flat-By-Default Rule.** Content sections, text blocks, and non-interactive containers carry no shadow. Depth is created through tonal layering (main-bg → surface → deep-charcoal), not shadows.

## 5. Components

### Buttons
Tactile and confident — pressing a CCPun button should feel like using a quality instrument.

- **Shape:** Gently curved (14px radius)
- **Primary:** Warm Gold background (`#e0c985`) with Deep Charcoal text (`#251818`). Padding 12px 28px. Gold glow shadow always present.
- **Primary Hover:** Gold Bright (`#ebd9a2`) background. Gold glow large shadow. Subtle upward translate (-2px).
- **Ghost:** Transparent background, Warm Gold border (1px) and text. Used for secondary CTAs.
- **Transition:** All transitions 200ms ease-out. No bounce, no spring.

### Page endings
- No full-width gold closing band (owner decision 2026-10-25). A page that needs an ending uses existing approved links (related articles, the About page) on the normal surface colour.
- No eyebrow label above section headings or tool-hero titles (owner decision 2026-10-25).

### Cards / Glass Panels
- **Corner Style:** 16px radius (rounded-lg)
- **Background:** Surface (`#4a3a3a`) at 60% opacity with backdrop-blur-md
- **Glass border:** `rgba(255,255,255,0.1)` — the edge that makes it read as glass
- **Shadow:** Glass ambient shadow
- **Internal Padding:** 24px (spacing-md)
- **Rule:** Never nest a glass card inside another glass card.

### Navigation
- **Style:** Glass panel, fixed, backdrop-blur. Gold underline for active link (not background highlight).
- **Typography:** Title weight (500), 0.875rem
- **Mobile:** Slide-in drawer, same glass treatment.
- **Active state:** Gold bottom border, no background tint.

### Inputs / Forms
- **Style:** Surface background, border-subtle outline (1px), 14px radius
- **Focus:** Gold ring (2px, warm-gold, 2px offset). Never colored background on focus.
- **Error:** Red-adjacent destructive color, message below field, not replacing the label.

### Signature: Hero CTA Block
The main conversion surface. Dark glass panel, large display headline, body copy, primary button with gold glow. The gold compass metaphor lives here — one directional signal in an otherwise restrained composition.

## 6. Do's and Don'ts

### Do:
- **Do** use Warm Gold on at most one primary CTA per viewport. Its scarcity is the point.
- **Do** apply `text-wrap: balance` to all headlines (h1–h3) to prevent ragged breaks.
- **Do** use the inset white highlight (`inset 0 1px 0 rgba(255,255,255,0.1)`) on every glass element — it is what makes glass read as glass.
- **Do** use the v5 CSS motion tokens from `components/layout/v5/motion-tokens.ts` and `V5.module.css`: micro/fast/base/slow durations with `--v5-ease-standard` or `--v5-ease-emphasized`; reduced motion ends immediately through the v5 root rule. Animate transform/opacity only, with stroke-dashoffset for decorative SVG drawing; no blur, bounce, overshoot, rotation or layout animation.
- **Toast motion pattern (future UI):** enter with `--v5-motion-base` and an 8px slide, exit with `--v5-motion-micro`, using `--v5-ease-standard`. Use `role="status"` and `aria-live="polite"`; no blur or scale. Reduced motion shows the final state immediately. This pattern adds no toast UI.
- **Do** add `@media (prefers-reduced-motion: reduce)` alternatives for every animation — Thai Gen X users on desktop may be in accessibility contexts.
- **Do** verify `ink-muted` (#baabab) passes 4.5:1 against Surface (#4a3a3a) before using it for body copy. It is borderline; increase weight if it fails.
- **Do** use Kanit 300 (light) for body copy — it reads cleanly at Thai paragraph density.

### Don't:
- **Don't** use gradient text (`background-clip: text`). It looks cheap against the Compass palette.
- **Don't** apply glassmorphism to section backgrounds, decorative dividers, or hero overlays that are not interactive. That is the decorative reflex this system explicitly rejects.
- **Don't** introduce a second typeface. Kanit is the system. Mixing in a serif "for elegance" breaks the Thai-first identity.
- **Don't** make the interface look like a Thai state bank (cold neutrals, government blue, formal ceremony) — it must feel personal, not institutional.
- **Don't** make it look like a generic Thai insurance agent site (stock photos, low-contrast text, clip-art decorations, amateur layout).
- **Don't** make it look like a Bulgari-style luxury brand (untouchable, distant, art-gallery whitespace) — CCPun must be reachable.
- **Don't** use `border-left` as a colored accent stripe on cards or callouts. Rewrite with a background tint or full border.
- **Don't** use identical card grids. If three cards appear in a row, vary their size, content density, or weight to create rhythm.
- **Don't** use all-caps Thai text at any size. Reserve uppercase for English-only labels (≤4 words).
- **Don't** animate CSS layout properties. Only transform and opacity for performance.
