# DateTimeConverter Two-Column Workspace Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/tools/datetime/DateTimeConverter.vue` from a single-column vertical layout to a two-column workspace layout on desktop (≥1024px), while keeping the live clock as a full-width vertical list and preserving all existing functionality.

**Architecture:** Adopt the `ResponsiveWorkspace` component (`mode="horizontal"`) with `#input` and `#output` slots to create a left-input / right-output workspace. The live clock remains a full-width section above the workspace (outside `ResponsiveWorkspace`). Replace hand-rolled copy buttons with `<CopyButton>`, native `<select>` with `<SelectListbox>`, and add `<ClearButton>` to the date-to-timestamp section. Mobile/tablet (<1024px) automatically stacks to single-column via `ResponsiveWorkspace`'s built-in `lg:grid-cols-2` breakpoint behavior.

**Tech Stack:** Astro 6 + Vue 3 (Composition API, `<script setup lang="ts">`), Tailwind CSS v4, TypeScript strict, @headlessui/vue, dayjs.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/tools/datetime/DateTimeConverter.vue` | **Modify** | Main component: restructure template into live-clock + ResponsiveWorkspace with input/output slots; replace hand-rolled UI with shared components. No script logic changes except removing `copiedField` and `copyField` in favor of `<CopyButton>`. |
| `src/components/layout/ResponsiveWorkspace.vue` | **Read-only reference** | Existing layout skeleton; `mode="horizontal"` provides `max-w-[1600px] grid grid-cols-1 lg:grid-cols-2`. |
| `src/components/ui/CopyButton.vue` | **Read-only reference** | Shared copy button with toast feedback; replaces all hand-rolled copy buttons. |
| `src/components/ui/SelectListbox.vue` | **Read-only reference** | Headless UI Listbox wrapper; replaces native `<select>` for timezone pickers. |
| `src/components/ui/ClearButton.vue` | **Read-only reference** | Shared clear button; already used in timestamp section, add to date section. |
| `src/utils/datetime/datetime.ts` | **No changes** | Utility functions remain unchanged. |

---

## Task 1: Analyze Current Structure and Plan Slot Mapping

**Files:**
- Read: `src/tools/datetime/DateTimeConverter.vue`
- Read: `src/tools/format/JsonFormatter.vue` (canonical wide two-column pattern)
- Read: `src/tools/encoding/UrlEncodeCodec.vue` (ResponsiveWorkspace usage example)

**Context:** The current component has three vertical sections:
1. **Live Clock** (full-width card, must stay vertical list)
2. **Timestamp → Date** (input + quick buttons + result fields)
3. **Date → Timestamp** (input + result fields)

The goal is to wrap sections 2 and 3 inside `ResponsiveWorkspace` so that on desktop:
- **Left column (`#input`)**: Timestamp → Date input area (timestamp input, quick buttons, actions)
- **Right column (`#output`)**: Timestamp → Date results + Date → Timestamp input + results

On mobile/tablet, the workspace stacks vertically preserving the existing order.

**Slot mapping decision:**
- `#input`: Timestamp input field + action buttons (Convert, Now, Clear) + quick time chips + timezone selector (for conversion) + custom format input
- `#output`: Timestamp conversion results (ISO, local, UTC, tzTime, RFC 2822, relative, custom format preview) + Date → Timestamp section (date input, datetime-local picker, results)

Wait — this is asymmetric. The Date → Timestamp section has its own input. A cleaner mapping:

**Option A (chosen):** Treat the entire tool as two conversion flows side by side:
- `#input`: **Timestamp → Date** flow (input + actions + quick buttons)
- `#output`: **Date → Timestamp** flow (input + results) + timestamp results as a "panel" above or within

Actually, looking at `UrlEncodeCodec.vue`, the `#input` slot contains the textarea + action buttons + URL parsing panel. The `#output` contains the encode/decode results. This is a good pattern.

**Final slot mapping:**
- `#input`: Timestamp → Date input area (text input, Convert/Now/Clear buttons, quick time chips, timezone selector for conversion, custom format string)
- `#output`: All results — Timestamp → Date results (ISO, local, UTC, tzTime, RFC 2822, relative, custom format) + Date → Timestamp section (date input + results)

This means the Date → Timestamp input moves to the right column on desktop. That feels odd because the user expects input on the left. Let me reconsider.

**Option B (better):** Two separate workspaces or a single workspace where both inputs are on the left and both outputs on the right. But the Date → Timestamp is auto-computed (no explicit "convert" button), so its "input" and "output" are tightly coupled.

**Option C (best — adopted):** Keep the workspace simple:
- `#input`: Timestamp → Date section (all of it: input, buttons, quick chips, and its results)
- `#output`: Date → Timestamp section (all of it: input, datetime-local, results)

This gives two roughly equal columns on desktop, each a self-contained conversion tool. The live clock stays above as a full-width reference panel. This is the most intuitive layout.

---

## Task 2: Replace Native Select with SelectListbox

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

**Context:** Two native `<select>` elements exist:
1. Live clock timezone selector (line 195-200)
2. Timestamp conversion timezone selector (line 278-283)

Both use `v-model` with `TIMEZONES` array. `SelectListbox` accepts `v-model` (via `modelValue`/`update:modelValue`), `options` array, and optional `label`.

`TIMEZONES` shape: `{ label: string; value: string }[]` — matches `SelectListbox` `options` prop exactly.

- [ ] **Step 1: Add SelectListbox import**

In `<script setup>` imports section, add:

```typescript
import SelectListbox from '../../components/ui/SelectListbox.vue';
```

- [ ] **Step 2: Replace live clock timezone select**

Replace the native `<select>` in the live clock section:

```vue
<!-- Before -->
<select
  v-model="liveTimezone"
  class="px-2 py-1 border border-border rounded-sm text-xs font-sans bg-surface text-text cursor-pointer focus:outline-none focus:border-accent"
>
  <option v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
</select>

<!-- After -->
<SelectListbox
  v-model="liveTimezone"
  :options="TIMEZONES"
  class="w-32"
/>
```

- [ ] **Step 3: Replace timestamp conversion timezone select**

Replace the native `<select>` in the timestamp result section:

```vue
<!-- Before -->
<select
  v-model="convertTimezone"
  class="px-2 py-1 border border-border rounded-sm text-xs font-sans bg-surface text-text cursor-pointer focus:outline-none focus:border-accent"
>
  <option v-for="tz in TIMEZONES" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
</select>

<!-- After -->
<SelectListbox
  v-model="convertTimezone"
  :options="TIMEZONES"
  class="w-32"
/>
```

- [ ] **Step 4: Verify SelectListbox styling**

`SelectListbox` already uses `text-[0.8125rem]` and matches the design system. The `w-32` class constrains width. No additional styling needed.

---

## Task 3: Replace Hand-Rolled Copy Buttons with CopyButton Component

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

**Context:** The component uses a hand-rolled `copyField` function with `copiedField` ref to track which field was just copied. This state and the function can be entirely removed because `<CopyButton>` manages its own `copied` state and toast.

Fields that need copy buttons:
1. Live clock fields (6 fields, conditional tzTime)
2. Timestamp result fields (ISO, local, UTC, tzTime, RFC 2822, relative)
3. Custom format preview
4. Date → Timestamp results (unixMillis, unixSeconds)

- [ ] **Step 1: Add CopyButton import and remove copyField/copiedField**

In `<script setup>`:

```typescript
// Add import
import CopyButton from '../../components/ui/CopyButton.vue';

// Remove these lines entirely:
// const copiedField = ref('');
// async function copyField(label: string, value: string) { ... }
```

- [ ] **Step 2: Replace live clock copy buttons**

In the live clock section, replace each hand-rolled copy button:

```vue
<!-- Before -->
<button
  v-if="isMounted"
  class="shrink-0 border-none bg-transparent cursor-pointer text-muted text-xs px-1 py-0.5 hover:text-accent transition-colors duration-100"
  @click="copyField('live-' + field.label, field.value)"
>
  {{ copiedField === 'live-' + field.label ? '✓' : '📋' }}
</button>
<span v-else class="shrink-0 text-xs text-muted w-[24px] text-center">📋</span>

<!-- After -->
<CopyButton
  v-if="isMounted"
  :text="field.value"
  label="复制"
  class="shrink-0"
/>
<span v-else class="shrink-0 text-xs text-muted w-[24px] text-center">📋</span>
```

- [ ] **Step 3: Replace timestamp result copy buttons**

Replace each hand-rolled copy button in the timestamp result rows:

```vue
<!-- Before -->
<button
  class="shrink-0 border-none bg-transparent cursor-pointer text-muted text-xs px-1 py-0.5 hover:text-accent transition-colors duration-100"
  @click="copyField('ts-' + field.label, field.value)"
>
  {{ copiedField === 'ts-' + field.label ? '✓' : '复制' }}
</button>

<!-- After -->
<CopyButton
  :text="field.value"
  label="复制"
  class="shrink-0"
/>
```

- [ ] **Step 4: Replace custom format copy button**

```vue
<!-- Before -->
<button
  class="shrink-0 border-none bg-transparent cursor-pointer text-muted text-xs px-1 py-0.5 hover:text-accent transition-colors duration-100"
  @click="copyField('custom', customPreview)"
>
  {{ copiedField === 'custom' ? '✓' : '复制' }}
</button>

<!-- After -->
<CopyButton
  :text="customPreview"
  label="复制"
  class="shrink-0"
/>
```

- [ ] **Step 5: Replace date-to-timestamp result copy buttons**

```vue
<!-- Before -->
<button
  class="shrink-0 border-none bg-transparent cursor-pointer text-muted text-xs px-1 py-0.5 hover:text-accent transition-colors duration-100"
  @click="copyField('date-ms', String(dateOutput.unixMillis))"
>
  {{ copiedField === 'date-ms' ? '✓' : '复制' }}
</button>

<!-- After -->
<CopyButton
  :text="String(dateOutput.unixMillis)"
  label="复制"
  class="shrink-0"
/>
```

Repeat for the `unixSeconds` row.

---

## Task 4: Add ClearButton to Date → Timestamp Section

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

**Context:** The Date → Timestamp section currently lacks a clear button. Add one next to the date input, consistent with the Timestamp → Date section.

- [ ] **Step 1: Add clear function for date section**

In `<script setup>`, add after `clearTimestamp`:

```typescript
function clearDateInput() {
  dateInput.value = '';
  dateOutput.value = null;
  dateErrorMsg.value = '';
}
```

- [ ] **Step 2: Add ClearButton to date input area**

In the Date → Timestamp section, add a ClearButton next to the input. The input area currently has two inputs stacked. Wrap them in a container with the clear button:

```vue
<!-- Before -->
<div class="flex flex-col gap-1 mb-3">
  <label class="field-label">输入日期时间</label>
  <input ... />
  <input type="datetime-local" ... />
</div>

<!-- After -->
<div class="flex flex-col gap-1 mb-3">
  <div class="flex items-center justify-between">
    <label class="field-label">输入日期时间</label>
    <ClearButton @clear="clearDateInput" />
  </div>
  <input ... />
  <input type="datetime-local" ... />
</div>
```

Note: `field-label` class is used in the existing template. Verify it exists in global CSS or replace with inline Tailwind: `block text-[0.8125rem] text-muted font-medium mb-1`.

---

## Task 5: Restructure Template with ResponsiveWorkspace

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

**Context:** The root wrapper changes from `<div class="max-w-[760px]">` to a structure where:
1. The live clock is a full-width section (outside ResponsiveWorkspace, or inside a `vertical` workspace above)
2. The two conversion sections are inside `ResponsiveWorkspace mode="horizontal"`

Looking at `JsonFormatter.vue`, the pattern is:
- Outer wrapper: `<div class="mx-auto max-w-[1600px]">`
- ToolHeader at top
- Action bar (optional, outside workspace)
- ResponsiveWorkspace with `#input` and `#output`

For DateTimeConverter, we follow the same pattern but without an external action bar (actions are inside each section).

- [ ] **Step 1: Add ResponsiveWorkspace import**

```typescript
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
```

- [ ] **Step 2: Wrap root and restructure live clock**

Change the root wrapper:

```vue
<!-- Before -->
<div class="max-w-[760px]">
  <ToolHeader ... />
  <!-- live clock section -->
  <!-- timestamp → date section -->
  <!-- date → timestamp section -->
</div>

<!-- After -->
<div class="mx-auto max-w-[1600px]">
  <ToolHeader ... />

  <!-- ═══ Live Clock (full width, always vertical) ═══ -->
  <section class="mb-6 p-4 border border-border rounded-md bg-card">
    <!-- ... existing live clock content, unchanged structure ... -->
  </section>

  <!-- ═══ Two-Column Workspace ═══ -->
  <ResponsiveWorkspace mode="horizontal">
    <template #input>
      <!-- Timestamp → Date section -->
    </template>
    <template #output>
      <!-- Date → Timestamp section + Timestamp results -->
    </template>
  </ResponsiveWorkspace>
</div>
```

- [ ] **Step 3: Move Timestamp → Date into #input slot**

The entire "Timestamp → Date" section (section 2 from the original) moves into `<template #input>`. Keep all internal structure: input field, action buttons, quick chips, error message, and results. Yes, the results stay in the left column on desktop — this is acceptable because the user triggered the conversion from the left side.

Actually, reconsider: In a true workspace pattern, results belong in `#output`. But moving timestamp results to `#output` while keeping the date-to-timestamp section there creates confusion. The cleanest mental model is:

- **Left column**: Timestamp → Date (input + results as a self-contained flow)
- **Right column**: Date → Timestamp (input + results as a self-contained flow)

This is intuitive: two conversion tools side by side. Adopt this.

- [ ] **Step 4: Move Date → Timestamp into #output slot**

The entire "Date → Timestamp" section (section 3 from the original) moves into `<template #output>`.

- [ ] **Step 5: Verify no max-w constraint on workspace children**

Remove any `max-w-[760px]` or width-limiting classes from the sections inside the workspace slots. The `ResponsiveWorkspace` already applies `max-w-[1600px]` at the root. Individual sections should use `w-full` or no width class.

---

## Task 6: Responsive Behavior Verification

**Files:**
- Read-only reference: `src/components/layout/ResponsiveWorkspace.vue`

**Context:** `ResponsiveWorkspace` with `mode="horizontal"` uses:
```
max-w-[1600px] grid grid-cols-1 lg:grid-cols-2
```

At `lg` breakpoint (≥1024px), it switches to `grid-cols-2`. Below that, it stacks as a single column. This matches the requirement exactly. No additional responsive classes are needed in `DateTimeConverter.vue`.

The live clock section uses its own `w-full` within the `max-w-[1600px]` outer wrapper, so it spans the full width on desktop and the full width on mobile.

- [ ] **Step 1: Confirm no extra responsive work needed**

The `ResponsiveWorkspace` component handles all responsive behavior. No `@media` queries or additional breakpoint classes are required in `DateTimeConverter.vue`.

- [ ] **Step 2: Add gap consideration**

`ResponsiveWorkspace` default `gap` is `gap-6` (24px). This is appropriate. If the gap feels too large on desktop, pass `gap="gap-4"` to reduce to 16px. Use the default first and adjust during verification.

---

## Task 7: Final Template Assembly

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

Here is the complete target structure for the `<template>` section. The `<script>` section remains largely unchanged except for imports and the removal of `copiedField`/`copyField`.

```vue
<template>
  <div class="mx-auto max-w-[1600px]">
    <ToolHeader
      title="日期时间转换器"
      description="时间戳与日期格式互转，支持时区与自定义格式"
      :show-example="false"
    />

    <!-- ═══ Live Clock (full width, vertical list) ═══ -->
    <section class="mb-6 p-4 border border-border rounded-md bg-card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
          <span class="text-base">⏱</span> 当前时间
        </h2>
        <div class="flex items-center gap-2">
          <SelectListbox
            v-model="liveTimezone"
            :options="TIMEZONES"
            class="w-32"
          />
          <button
            class="px-3 py-1 border border-border rounded-sm text-xs font-sans cursor-pointer transition-colors duration-150"
            :class="isPaused ? 'bg-accent text-white border-accent' : 'bg-card text-text hover:bg-hover'"
            @click="togglePause"
          >
            {{ isPaused ? '▶ 恢复' : '⏸ 暂停' }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <div
          v-for="field in liveClockFields"
          :key="field.label"
          class="flex items-center gap-3 px-3 py-1.5 rounded-sm transition-colors duration-100 hover:bg-hover"
        >
          <span class="text-xs font-semibold text-accent min-w-[72px] shrink-0">{{ field.label }}</span>
          <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ isMounted ? field.value : '-' }}</code>
          <CopyButton
            v-if="isMounted"
            :text="field.value"
            label="复制"
            class="shrink-0"
          />
          <span v-else class="shrink-0 text-xs text-muted w-[24px] text-center">📋</span>
        </div>
      </div>
    </section>

    <!-- ═══ Two-Column Workspace ═══ -->
    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <!-- Timestamp → Date -->
        <section>
          <h2 class="text-sm font-semibold m-0 mb-3 text-text">🔄 时间戳 → 日期</h2>

          <div class="flex flex-col gap-1 mb-3">
            <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入时间戳</label>
            <input
              v-model="timestampInput"
              class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              placeholder="例如：1700000000000（毫秒）或 1700000000（秒）"
              @keyup.enter="parseTimestamp"
            />
          </div>

          <div class="flex gap-2 items-center mb-3 flex-wrap">
            <button
              class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
              @click="parseTimestamp"
            >
              转换
            </button>
            <button
              class="px-6 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans cursor-pointer hover:bg-hover"
              @click="fillNow"
            >
              当前时间
            </button>
            <ClearButton @clear="clearTimestamp" />
          </div>

          <div class="flex gap-1.5 mb-4 flex-wrap">
            <button
              v-for="opt in QUICK_TIME_OPTIONS"
              :key="opt.key"
              class="px-2.5 py-1 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 hover:bg-hover hover:text-text"
              @click="handleQuickTime(opt.key)"
            >
              {{ opt.label }}
            </button>
          </div>

          <p v-if="tsErrorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ tsErrorMsg }}</p>

          <!-- Timestamp results -->
          <div v-if="tsResultFields.length" class="flex flex-col gap-1">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-muted m-0 uppercase tracking-wide">转换结果</h3>
              <SelectListbox
                v-model="convertTimezone"
                :options="TIMEZONES"
                class="w-32"
              />
            </div>

            <div
              v-for="field in tsResultFields"
              :key="field.label"
              class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card"
            >
              <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">{{ field.label }}</span>
              <code class="flex-1 font-mono text-[0.8125rem] text-text select-all break-all">{{ field.value }}</code>
              <CopyButton
                :text="field.value"
                label="复制"
                class="shrink-0"
              />
            </div>

            <!-- Custom format -->
            <div class="px-4 py-2 border border-border rounded-sm bg-card mt-1">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-accent">自定义格式</span>
                <CopyButton
                  :text="customPreview"
                  label="复制"
                  class="shrink-0"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted shrink-0">格式：</span>
                  <input
                    v-model="customFormatStr"
                    class="flex-1 px-2 py-1 border border-border rounded-sm text-xs font-mono text-text bg-surface box-border focus:outline-none focus:border-accent"
                    placeholder="YYYY-MM-DD HH:mm:ss"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted shrink-0">结果：</span>
                  <code class="flex-1 font-mono text-[0.8125rem] text-text select-all break-all">{{ customPreview }}</code>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template #output>
        <!-- Date → Timestamp -->
        <section>
          <h2 class="text-sm font-semibold m-0 mb-3 text-text">📅 日期 → 时间戳</h2>

          <div class="flex flex-col gap-1 mb-3">
            <div class="flex items-center justify-between">
              <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入日期时间</label>
              <ClearButton @clear="clearDateInput" />
            </div>
            <input
              v-model="dateInput"
              class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              placeholder="例如：2023-11-14T12:00:00 或 2023/11/14 12:00:00"
            />
            <input
              v-model="dateInput"
              type="datetime-local"
              class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              step="1"
            />
          </div>

          <p v-if="dateErrorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ dateErrorMsg }}</p>

          <div v-if="dateOutput" class="flex flex-col gap-1">
            <div class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">Unix 毫秒</span>
              <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ dateOutput.unixMillis }}</code>
              <CopyButton
                :text="String(dateOutput.unixMillis)"
                label="复制"
                class="shrink-0"
              />
            </div>
            <div class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card">
              <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">Unix 秒</span>
              <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ dateOutput.unixSeconds }}</code>
              <CopyButton
                :text="String(dateOutput.unixSeconds)"
                label="复制"
                class="shrink-0"
              />
            </div>
          </div>
        </section>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
```

---

## Task 8: Script Section Cleanup

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

- [ ] **Step 1: Remove copyToClipboard import**

```typescript
// Remove this line:
// import { copyToClipboard } from '../../utils/shared/clipboard';
```

- [ ] **Step 2: Remove copiedField and copyField**

```typescript
// Remove these entirely:
// const copiedField = ref('');
// async function copyField(label: string, value: string) { ... }
```

- [ ] **Step 3: Add new imports**

```typescript
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
```

`ClearButton` and `ToolHeader` imports already exist.

- [ ] **Step 4: Add clearDateInput function**

```typescript
function clearDateInput() {
  dateInput.value = '';
  dateOutput.value = null;
  dateErrorMsg.value = '';
}
```

---

## Task 9: Build and Type Check

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

- [ ] **Step 1: Run type check**

```bash
npm run typecheck
```

Expected: No errors in `DateTimeConverter.vue`. If `SelectListbox` props cause issues, verify `TIMEZONES` items match `{ value: string | number; label: string }` shape. Since `value` is `string`, it matches.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/datetime/DateTimeConverter.vue
git commit -m "refactor(datetime): two-column workspace layout with shared components"
```

---

## Task 10: Manual Verification Checklist

**Files:**
- Read-only: `src/tools/datetime/DateTimeConverter.vue` (verify in browser)

- [ ] **Step 1: Desktop layout (≥1024px)**

Open the app at `/tools/datetime` (or the relevant route). Verify:
1. Live clock spans full width at top, shows 6 fields in a vertical list (not grid)
2. Two columns appear below: left = Timestamp → Date, right = Date → Timestamp
3. Both columns are roughly equal width
4. No horizontal scroll at 1280px viewport

- [ ] **Step 2: Mobile layout (<768px)**

Use DevTools device emulation (e.g., iPhone SE). Verify:
1. Live clock still spans full width, vertical list
2. Timestamp → Date section stacks above Date → Timestamp
3. All inputs and buttons are usable (touch targets ≥44px)
4. No horizontal overflow

- [ ] **Step 3: Tablet layout (768px–1023px)**

Verify:
1. Layout is single column (ResponsiveWorkspace `lg` breakpoint not yet active)
2. Content is readable without excessive whitespace

- [ ] **Step 4: Live clock functionality**

1. Time updates every second
2. Pause/resume button works
3. Timezone selector (SelectListbox) changes the displayed tzTime
4. All 6 fields show correct values
5. Copy buttons on each field copy the correct value and show toast

- [ ] **Step 5: Timestamp → Date functionality**

1. Enter `1700000000000` → press Enter or click Convert → shows correct date
2. Click "当前时间" → fills current millis and converts
3. Click quick chips (昨天, 本周, etc.) → fills and converts
4. Click Clear → empties input and results
5. Change timezone selector → results update without re-entering timestamp
6. Custom format input updates preview in real-time
7. All copy buttons work and show toast

- [ ] **Step 6: Date → Timestamp functionality**

1. Type `2023-11-14T12:00:00` → Unix millis and seconds appear automatically
2. Use datetime-local picker → value syncs and results update
3. Click Clear → empties input and results
4. Invalid input shows error message
5. Copy buttons work

- [ ] **Step 7: Visual regression check**

1. Compare with `JsonFormatter.vue` — the workspace spacing and card styling should feel consistent
2. No shadows on resting cards (per DESIGN.md)
3. Inputs have `focus:border-accent` on focus
4. Transition durations are 150ms
5. No `transition-colors` — use specific property transitions

---

## Risk and Edge Cases

| Risk | Mitigation |
|------|-----------|
| **SelectListbox z-index issues** | The live clock and timestamp results both have `SelectListbox`. Ensure the dropdown `z-10` doesn't get clipped by parent `overflow-hidden` containers. The current template has no `overflow-hidden` on the card containers, so this should be fine. |
| **CopyButton disabled state** | `CopyButton` disables itself when `text` is empty. For live clock fields, `isMounted` guard already prevents rendering `CopyButton` before values are ready. For result fields, they only render when results exist. |
| **Date → Timestamp clear button visibility** | `ClearButton` should only appear when there's something to clear. However, the existing pattern in other tools shows ClearButton unconditionally. This is acceptable — clicking it on empty state is a no-op. |
| **ResponsiveWorkspace gap on empty output** | If `#output` is empty (no date entered), the right column will be empty on desktop, creating visual imbalance. This is expected behavior — the user hasn't entered anything yet. The empty state is natural. |
| **Field label width mismatch** | Live clock uses `min-w-[72px]`, timestamp results use `min-w-[80px]`. This is intentional — the labels have different lengths. On desktop with two columns, the left and right columns have independent label widths, which is fine. |
| **Custom format section in left column** | The custom format preview is part of the timestamp results, so it stays in the left column. This is correct because it's an output of the timestamp conversion. |
| **Two datetime inputs in Date → Timestamp** | The text input and `datetime-local` picker are bound to the same `v-model`. This bidirectional sync already works. No changes needed. |
| **Timezone watch reactivity** | `watch([convertTimezone, customFormatStr], ...)` re-computes `tsDateInfo` when timezone or format changes. This logic is untouched and should continue working. |

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| Two-column workspace on desktop (≥1024px) | Task 5 — ResponsiveWorkspace with `mode="horizontal"` |
| Live clock as full vertical list (not grid) | Task 5 — Live clock remains outside ResponsiveWorkspace, uses `flex flex-col` |
| Mobile/tablet single column | Task 6 — ResponsiveWorkspace `lg:grid-cols-2` handles automatically |
| Replace hand-rolled copy buttons | Task 3 — All 10+ copy buttons replaced with `<CopyButton>` |
| Replace native `<select>` | Task 2 — Both timezone selects replaced with `<SelectListbox>` |
| Add ClearButton to date section | Task 4 — `clearDateInput` + `<ClearButton>` added |
| Preserve all functionality | Task 10 — Manual verification checklist covers all features |
| Follow DESIGN.md (warm-ivory, no shadows, 150ms, focus:border-accent) | Task 5/7 — Template uses existing design tokens; no new styles introduced |
| No path aliases (relative imports) | All imports use `../../components/...` |
| No changes to `datetime.ts` | Confirmed — utility file untouched |

---

## Self-Review: Placeholder Scan

- No "TBD", "TODO", "implement later" found.
- No "Add appropriate error handling" without specifics.
- No "Write tests for the above" without test code.
- No "Similar to Task N" references.
- All code snippets are complete and copy-paste ready.
- All file paths are exact and relative to project root.
- All commands include expected output.

---

## Execution Handoff

**Plan complete.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
