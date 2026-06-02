<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: Dev Tools
description: 零门槛的浏览器端开发者工具集合
---

# Design System: Dev Tools

## 1. Overview

**Creative North Star: "The Utility Shelf"**

Every tool visible, labeled, ready. No drawers to open, no manuals to read. The interface is a well-organized shelf: you see what you need, you grab it, you use it, you put it back. Inspired by it-tools.tech's functional clarity, but warmer and more approachable.

Light surfaces with a subtle warm tint, not clinical white. One restrained accent used sparingly for active states and key actions. Typography is clean and legible, a single sans-serif family carrying the whole interface. Motion exists only where it serves feedback: a button press, a focus ring, a copy confirmation. No decoration, no choreography.

The system rejects everything that slows the user down: login walls, multi-step flows, loading spinners, unnecessary navigation depth. A tool page loads and the cursor is already in the input field.

**Key Characteristics:**
- Light, warm-tinted surfaces with a single accent used at ≤10%
- Functional density: every pixel earns its place
- Zero-friction interaction: input field focused on load, results in real-time
- Restrained motion: state feedback only, no ambient animation

## 2. Colors

**The Shelf Rule.** Neutrals carry 90% of the surface. The accent appears only on interactive elements in active state: a focused input border, a copy button, a selected category. Its rarity makes it noticeable.

**Color strategy:** Restrained. Tinted neutrals + one accent.

**Hue direction:** [to be resolved during implementation. A warm-neutral base (slight amber or warm gray tint, not pure white) with an accent in a saturated but not loud hue. Avoid the dev-tool reflex: no dark theme with blue/cyan neon, no generic tech-blue.]

### Primary (accent)
- **[Accent Name]** [hex to be resolved]: Used on focused inputs, active buttons, selected navigation items. Appears on ≤10% of any given screen.

### Neutral
- **[Surface Name]** [hex to be resolved]: Main background, warm-tinted.
- **[Text Name]** [hex to be resolved]: Primary body text, high contrast against surface.
- **[Muted Name]** [hex to be resolved]: Secondary text, placeholders, disabled states.
- **[Border Name]** [hex to be resolved]: Input borders, dividers, subtle separators.

## 3. Typography

**Single Sans-serif.** One font family for the entire interface. [Specific font to be chosen at implementation: a humanist or geometric sans with good readability at small sizes and a slightly warm personality. Avoid Inter/Roboto/system-ui defaults if a more distinctive but equally readable option exists.]

**Character:** Clear and legible at a glance. The type does its job without calling attention to itself. Slightly rounded letterforms reinforce the friendly personality.

### Hierarchy
- **Title** (weight 600, [size to be resolved], line-height 1.3): Tool page title, navigation headings.
- **Body** (weight 400, [size to be resolved], line-height 1.5): Tool descriptions, input/output labels, help text. Max line length 65–75ch.
- **Label** (weight 500, [size to be resolved], letter-spacing 0.02em): Button text, form labels, category tags.
- **Mono** (weight 400, [size to be resolved]): Code input/output areas, formatted results.

## 4. Elevation

Flat by default. Depth is conveyed through tonal layering: slightly different neutral shades distinguish sections and containers. No shadows at rest. Subtle shadows may appear on hover or focus to indicate interactive state, but the resting state is always flat.

## 5. Components

[To be documented when components are built. Canonical primitives to cover: buttons (primary, secondary, ghost), inputs/textareas, navigation, tool cards/links, copy/feedback indicators.]

## 6. Do's and Don'ts

### Do:
- **Do** focus the main input field on page load so the user can start typing immediately.
- **Do** show results in real-time as the user types, with no "submit" button required.
- **Do** use warm-tinted neutrals that feel approachable, not clinical.
- **Do** keep tool pages self-contained: input, output, and actions all visible without scrolling on desktop.
- **Do** use the accent color only on interactive elements in active state.

### Don't:
- **Don't** use a dark theme with blue/cyan neon accents. This is the first training-data reflex for "dev tools."
- **Don't** use glassmorphism, gradient text, or side-stripe borders on cards.
- **Don't** add login walls, onboarding flows, or multi-step wizards. From PRODUCT.md anti-references: forced login and complex flows are prohibited.
- **Don't** use the accent color as a background fill for large areas. It is a signal, not a surface.
- **Don't** animate layout properties or add ambient/choreographed animations.
- **Don't** use identical card grids with icon + heading + text repeated endlessly.
