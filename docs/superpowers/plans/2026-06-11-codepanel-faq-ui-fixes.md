# CodePanel Button Overlap & FAQ HTML Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CodePanel action buttons obscuring content and improve FAQ readability by distinguishing question/answer colors and styling inline HTML tags.

**Architecture:** Keep the existing CodePanel API and slot contract intact; move the copy/clear button group out of the content overlay by adding a dedicated action bar above the content area. Update FAQ markup in ToolLayout.astro to render questions in `text-text` and answers in `text-muted`, and scope inline element styles (`<code>`, `<strong>`) to the answer container.

**Tech Stack:** Astro 6, Vue 3, Tailwind CSS v4, TypeScript.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/ui/CodePanel.vue` | Wrap slot in a flex column; render action buttons in a toolbar above the slot instead of absolutely over it. |
| `src/layouts/ToolLayout.astro` | Update FAQ markup: distinct question/answer colors, scoped inline HTML styles, maintain existing `<details>`/`<summary>` behavior. |
| `src/tools/devops/DockerConverter.vue` | Verify no consumer-side padding changes are needed; textarea already has `px-4 py-2`. |
| `src/tools/editor/MarkdownEditor.vue` | Verify editor/ preview panels still render correctly with new CodePanel layout. |
| `src/tools/format/JsonToXml.vue` | Verify input/ output panels still render correctly with new CodePanel layout. |
| `src/tools/format/JsonToYaml.vue` | Verify input/ output panels still render correctly with new CodePanel layout. |

---

## Design Decisions

### CodePanel button overlap

#### Option A: Dedicated action bar above content (recommended)
Move `showCopy` / `showClear` buttons into a flex row between the label and the content slot. The slot remains untouched. Pros: no content is ever covered; buttons stay visible and reachable; works with any slot content (textarea, pre, div); minimal CSS change. Cons: uses a small amount of vertical space above the panel.

#### Option B: Increase content top padding
Keep buttons absolutely positioned at `top-2 right-2` but add top padding (`pt-10` or similar) to the slot container so text cannot reach the button area. Pros: buttons stay in a familiar corner. Cons: the slot container must size itself to the content, which is hard with arbitrary slot content; empty panels look odd with extra top whitespace; still partially obscures any content that happens to wrap into the reserved zone.

#### Option C: Float buttons outside the panel on the right edge
Position buttons outside the panel border at the top-right. Pros: no overlap. Cons: breaks the visual panel boundary; may overflow on narrow viewports; inconsistent with other tool UIs.

**Recommendation:** Option A. It is the most robust, accessible, and layout-safe choice, and it preserves the existing slot contract without requiring consumers to change their padding.

### FAQ styling

- Question (`<summary>`): use `text-text` so it reads as the primary interactive label.
- Answer (`<div>`): keep `text-muted` for secondary reading, but add scoped child styles for inline HTML.
- `<code>`: `bg-hover`, `text-text`, `font-mono`, small padding/ radius.
- `<strong>`: `text-text font-semibold` (or `font-bold`; use existing `font-semibold` convention).
- Keep transitions and focus behavior consistent with DESIGN.md: no focus ring on `<details>`/`<summary>`; color transition on summary hover already exists.

---

## Task 1: Refactor CodePanel.vue action buttons to a toolbar layout

**Files:**
- Modify: `src/components/ui/CodePanel.vue`

- [ ] **Step 1: Replace the relative content wrapper with a flex column and add a toolbar row**

Locate the `<div class="relative">` that wraps `<slot />`. Change it to a vertical flex container. Move the existing button group out of the absolute overlay and into a new toolbar div rendered conditionally above the slot.

Replace lines 73-156 (`<div class="relative">` through its closing `</div>`) with:

```vue
    <div class="flex flex-col">
      <!-- 操作按钮工具栏 -->
      <div
        v-if="showCopy || showClear"
        class="flex justify-end gap-1 pb-1.5"
      >
        <!-- 复制按钮 -->
        <button
          v-if="showCopy"
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-sm border transition-[background-color,border-color,color] duration-150"
          :class="[
            copied
              ? 'border-success text-success bg-card'
              : 'border-border text-muted bg-card hover:bg-hover hover:text-text',
            (!copyText || disabled) && 'opacity-50 cursor-not-allowed',
          ]"
          :disabled="!copyText || disabled"
          :title="copied ? '已复制' : '复制'"
          @click="handleCopy"
        >
          <!-- 已复制图标 -->
          <svg
            v-if="copied"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>

          <!-- 复制图标 -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        <!-- 清空按钮 -->
        <button
          v-if="showClear"
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
          :class="disabled && 'opacity-50 cursor-not-allowed'"
          :disabled="disabled"
          title="清空"
          @click="handleClear"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      <slot />
    </div>
```

Key changes from the old implementation:
- Removed `relative` and `absolute` positioning.
- Buttons now live in a flex row with `justify-end` and `pb-1.5` above the slot.
- Removed the `bg-card/90` translucent backgrounds; buttons sit on the page background (`bg-card` is still applied for consistency with other icon buttons, but no opacity is needed because they no longer overlap content).
- Kept all existing props, emits, handlers, icons, disabled states, and transition classes.

- [ ] **Step 2: Verify TypeScript and template compile**

Run: `npm run astro check`
Expected: no errors in `src/components/ui/CodePanel.vue`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CodePanel.vue
git commit -m "fix(ui): move CodePanel copy/clear buttons out of content overlay"
```

---

## Task 2: Update FAQ styling in ToolLayout.astro

**Files:**
- Modify: `src/layouts/ToolLayout.astro`

- [ ] **Step 1: Update FAQ summary and answer markup**

Locate the FAQ `<section>` (lines 345-362). Replace the inner `<details>` block with the following markup, keeping the outer section container and heading unchanged:

```astro
            <details class="group py-4">
              <summary class="flex items-center justify-between cursor-pointer text-[0.8125rem] text-text hover:text-accent transition-[color] duration-150 list-none">
                <span>{faq.question}</span>
                <svg class="h-4 w-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                </svg>
              </summary>
              <div class="faq-answer pt-2 text-[0.8125rem] text-muted leading-relaxed" set:html={faq.answer} />
            </details>
```

Changes:
- `<summary>`: changed `text-muted` to `text-text` so questions stand out.
- `<summary>` hover: changed `hover:text-text` to `hover:text-accent` to match the design system rule that accent is reserved for active interactive elements.
- Answer `<div>`: added `faq-answer` class for scoped child styling.

- [ ] **Step 2: Add scoped FAQ answer styles**

Append the following CSS to the existing `<style>` block at the bottom of `ToolLayout.astro` (after the existing `@media (max-width: 1023px)` rule):

```css
  /* FAQ answer inline HTML styling */
  .faq-answer code {
    background-color: var(--color-hover);
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
  }
  .faq-answer strong {
    color: var(--color-text);
    font-weight: 600;
  }
```

Rationale:
- Uses existing CSS custom properties from `global.css` so colors stay consistent with the warm ivory theme.
- `<code>` styling mirrors the Markdown preview `code` style but at a slightly smaller size to fit the 0.8125rem answer text.
- `<strong>` is darkened to `text-text` and semibold for emphasis without introducing new colors.

- [ ] **Step 3: Verify Astro check and build**

Run: `npm run astro check`
Expected: no errors in `src/layouts/ToolLayout.astro`.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/ToolLayout.astro
git commit -m "fix(layout): distinguish FAQ question/answer colors and style inline HTML"
```

---

## Task 3: Smoke-test consumers of CodePanel

**Files:**
- Read-only verification: `src/tools/devops/DockerConverter.vue`, `src/tools/editor/MarkdownEditor.vue`, `src/tools/format/JsonToXml.vue`, `src/tools/format/JsonToYaml.vue`

- [ ] **Step 1: Confirm no consumer changes are required**

All four consumers pass a single textarea or div/pre as the default slot. Because the slot itself is unchanged and the new toolbar is rendered above it, existing padding on textarea elements (`px-4 py-2`, `p-3`, `p-4`) remains correct. No prop or emit changes are introduced.

- [ ] **Step 2: Run the dev server and visually inspect each tool**

Run: `npm run dev`
Open in browser:
- `/devops/docker-converter`
- `/editor/markdown-editor`
- `/format/json-to-xml`
- `/format/json-to-yaml`

For each page:
1. Confirm the copy/clear icon buttons appear above the panel content, not over it.
2. Fill the textarea with long wrapping text and confirm no text is hidden behind buttons.
3. Confirm buttons still copy/clear as expected.

- [ ] **Step 3: Inspect FAQ on a tool page that has FAQs**

Open `/encoding/base64` (or any tool with configured FAQs in `src/data/tool-faqs.ts`).
1. Confirm the question text is darker (`text-text`) than the answer text (`text-muted`).
2. Expand an FAQ containing `<code>` and `<strong>` tags and confirm they render with the new styles.
3. Confirm the `<details>`/`<summary>` expand/collapse animation and chevron rotation still work.

- [ ] **Step 4: Commit any dev-only notes (no code changes expected)**

If no code changes were required in consumers, no commit is needed. If any consumer padding adjustments are discovered during visual testing, document and commit them separately.

---

## Risks & Side Effects

1. **Vertical space increase in CodePanel:** Moving buttons above the panel adds roughly 42px (`h-9` + `pb-1.5`) per panel. In horizontal split layouts this is negligible; in very short viewports it slightly reduces available content height. Mitigation: the change is uniform across all consumers and does not affect layout math inside the slot.
2. **Button background change:** Removed `bg-card/90` opacity. Buttons now use solid `bg-card`. This is consistent with other icon buttons in the header and toolbar, and avoids a subtle visual difference now that they sit on the page surface rather than over content.
3. **FAQ summary hover color change:** Changed from `hover:text-text` to `hover:text-accent`. This aligns with DESIGN.md (accent only on active interactive elements) but is a visible change. If product preference is to keep hover muted, revert to `hover:text-text`; either option satisfies the original complaint.
4. **Scoped `.faq-answer` styles:** These only apply inside the answer div and will not leak to other parts of the page. They use existing CSS variables, so no new design tokens are introduced.
5. **No dark mode considerations:** DESIGN.md specifies warm ivory light theme only, so no dark variants are added.

---

## Self-Review

**Spec coverage:**
- Requirement 1 (CodePanel options + recommendation): covered in Design Decisions and implemented in Task 1 (Option A).
- Requirement 2 (FAQ distinct colors + inline HTML): covered in Design Decisions and implemented in Task 2.
- Requirement 3 (files to modify): listed in File Structure and each task.
- Requirement 4 (risks/side effects): covered in Risks & Side Effects.
- Requirement 5 (minimal, design-system consistent): changes are scoped to two files, reuse existing tokens, and preserve all public APIs.

**Placeholder scan:** No TBD/TODO/filler steps.

**Type consistency:** No new types or props introduced; existing `Props`/`Emits` in CodePanel remain unchanged.
