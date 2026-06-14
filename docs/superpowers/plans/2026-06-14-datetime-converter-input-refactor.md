# 日期时间转换器输入框样式重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `DateTimeConverter.vue` 左栏的两个输入框重构为视觉一致、双向自动同步的对称卡片结构。

**Architecture:** 保持现有 Vue 3 Composition API 和工具函数不变，仅重构模板结构与输入框联动逻辑。两个输入框作为等价双向入口，任一输入有效时自动同步到另一侧；快捷按钮同时填充两个输入框。

**Tech Stack:** Astro 6 + Vue 3 + Tailwind CSS v4 + dayjs

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/tools/datetime/DateTimeConverter.vue` | 日期时间转换器主组件，包含模板、样式、交互逻辑 | 修改 |
| `src/components/ui/CopyButton.vue` | 通用复制按钮 | 复用 |
| `src/components/ui/ClearButton.vue` | 通用清空按钮 | 复用 |
| `src/components/ui/SelectListbox.vue` | 通用下拉选择 | 复用 |

---

## Task 1: 重构左栏输入区模板为双卡片结构

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue:245-419`

- [ ] **Step 1: 替换 `<template>` 中的左栏输入区**

  将当前模板中 `<!-- ═══ 双栏工作区：输入左 / 输出右 ═══ -->` 下方的左栏 `template #input` 部分替换为以下结构。右栏 `template #output` 保持不变。

  ```vue
  <template>
    <div class="mx-auto max-w-[1600px]">
      <ToolHeader title="日期时间转换器" description="时间戳与日期格式互转，支持时区与自定义格式" :show-example="false" />

      <!-- ═══ 实时时钟区 ═══ -->
      <section class="mb-6 p-4 border border-border rounded-md bg-card">
        <div class="flex items-center gap-3 mb-3 flex-wrap">
          <h2 class="text-sm font-semibold m-0 text-text flex items-center gap-2">
            <span class="text-base">⏱</span> 当前时间
          </h2>
          <SelectListbox
            v-model="liveTimezone"
            :options="TIMEZONES"
            class="w-32"
          />
        </div>

        <div class="flex flex-col gap-1">
          <div
            v-for="field in liveClockFields"
            :key="field.label"
            class="flex items-center gap-3 px-3 py-1 rounded-sm transition-colors duration-100 hover:bg-hover"
          >
            <span class="text-xs font-semibold text-accent min-w-[72px] shrink-0">{{ field.label }}</span>
            <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">{{ isMounted ? field.value : '-' }}</code>
            <CopyButton
              v-if="isMounted"
              :text="field.value"
              label="复制"
              class="px-2 py-1 text-xs shrink-0"
            />
            <span v-else class="shrink-0 text-xs text-muted w-[24px] text-center">📋</span>
          </div>
        </div>
      </section>

      <!-- ═══ 双栏工作区：输入左 / 输出右 ═══ -->
      <ResponsiveWorkspace mode="horizontal">
        <template #input>
          <section class="p-4 border border-border rounded-md bg-card">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold m-0 text-text">转换源</h2>
              <ClearButton @clear="clearAll" />
            </div>

            <!-- 快捷按钮 -->
            <div class="flex gap-1.5 mb-4 flex-wrap">
              <button
                v-for="opt in QUICK_TIME_OPTIONS"
                :key="opt.key"
                type="button"
                class="px-2.5 py-1 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 focus:outline-none focus:text-accent focus:border-accent"
                @click="handleQuickTime(opt.key)"
              >
                {{ opt.label }}
              </button>
            </div>

            <!-- 双源卡片区 -->
            <div class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <!-- Unix 时间戳卡片 -->
              <div class="bg-surface border border-border rounded-sm overflow-hidden">
                <div class="px-3 py-2 border-b border-border bg-card">
                  <label class="block text-[0.8125rem] text-muted font-medium">Unix 时间戳</label>
                </div>
                <div class="px-3 py-3">
                  <input
                    v-model="timestampInput"
                    class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
                    placeholder="秒或毫秒"
                    :aria-describedby="tsErrorMsg ? 'ts-error' : undefined"
                  />
                </div>
                <div class="px-3 py-2 border-t border-border bg-card flex gap-2">
                  <CopyButton :text="timestampInput" label="复制" class="text-xs px-0 py-0" />
                </div>
              </div>

              <!-- 中间占位/同步指示 -->
              <div class="justify-self-center text-muted text-xs font-sans select-none hidden md:block">⇄</div>

              <!-- 日期时间卡片 -->
              <div class="bg-surface border border-border rounded-sm overflow-hidden">
                <div class="px-3 py-2 border-b border-border bg-card">
                  <label class="block text-[0.8125rem] text-muted font-medium">日期时间</label>
                </div>
                <div class="px-3 py-3">
                  <input
                    v-model="dateInput"
                    class="w-full bg-transparent border-0 p-0 font-mono text-sm text-text placeholder:text-muted focus:outline-none"
                    placeholder="yyyy/MM/dd HH:mm:ss"
                    :aria-describedby="dateErrorMsg ? 'date-error' : undefined"
                  />
                </div>
                <div class="px-3 py-2 border-t border-border bg-card flex gap-2">
                  <button
                    type="button"
                    class="text-xs text-muted bg-transparent focus:outline-none focus:text-accent"
                    aria-label="打开日期选择器"
                    @click="openDatePicker"
                  >
                    📅 选择
                  </button>
                  <CopyButton :text="dateInput" label="复制" class="text-xs px-0 py-0" />
                </div>
              </div>
            </div>

            <!-- 错误占位 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div class="min-h-[20px]">
                <p
                  v-if="tsErrorMsg"
                  id="ts-error"
                  class="text-error text-[0.8125rem] m-0"
                >
                  {{ tsErrorMsg }}
                </p>
              </div>
              <div class="min-h-[20px]">
                <p
                  v-if="dateErrorMsg"
                  id="date-error"
                  class="text-error text-[0.8125rem] m-0"
                >
                  {{ dateErrorMsg }}
                </p>
              </div>
            </div>

            <input
              ref="datePickerRef"
              type="datetime-local"
              class="sr-only"
              aria-hidden="true"
              tabindex="-1"
              :value="pickerValue"
              @input="onPickerInput"
            />
          </section>
        </template>

        <template #output>
          <!-- 右栏保持现有结构不变 -->
          <section>
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-xs font-semibold text-muted m-0 uppercase tracking-wide">转换结果</h3>
                <SelectListbox
                  v-model="convertTimezone"
                  :options="TIMEZONES"
                  class="w-32"
                />
              </div>

              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="text-xs text-muted shrink-0">自定义格式：</span>
                <input
                  v-model="customFormatStr"
                  class="flex-1 min-w-0 px-2 py-1 border border-border rounded-sm text-xs font-mono text-text bg-surface box-border focus:outline-none focus:border-accent"
                  placeholder="YYYY-MM-DD HH:mm:ss"
                />
              </div>

              <template v-if="unifiedResult">
                <div
                  v-for="field in unifiedResultFields"
                  :key="field.label"
                  class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card"
                >
                  <span class="text-xs font-semibold text-accent min-w-[80px] shrink-0">{{ field.label }}</span>
                  <code class="flex-1 font-mono text-[0.8125rem] text-text select-all break-all">{{ field.value }}</code>
                  <CopyButton
                    :text="field.value"
                    label="复制"
                    class="px-2 py-1 text-xs shrink-0"
                  />
                </div>
              </template>

              <div v-else class="flex items-center justify-center px-4 py-8 border border-border rounded-sm bg-card">
                <p class="text-muted text-[0.8125rem] m-0">在左侧输入时间戳或日期以查看转换结果</p>
              </div>
            </div>
          </section>
        </template>
      </ResponsiveWorkspace>
    </div>
  </template>
  ```

- [ ] **Step 2: 运行开发服务器确认模板无语法错误**

  ```bash
  pnpm dev
  ```

  Expected: 终端无编译错误，页面可访问 `http://localhost:4321/datetime/datetime-converter`。

- [ ] **Step 3: 提交**

  ```bash
  git add src/tools/datetime/DateTimeConverter.vue
  git commit -m "refactor(datetime): 重构输入区为双卡片结构

- 将时间戳和日期输入框改为对称卡片
- 移除内嵌的当前按钮
- 添加复制按钮和日期选择按钮
- 使用 grid 布局实现桌面端并排、移动端堆叠

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

## Task 2: 实现双向自动同步逻辑

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue:106-209`

- [ ] **Step 1: 修改 `watch(timestampInput)` 以同步日期输入框**

  将 `// ─── 时间戳输入 ───` 下方的 `watch(timestampInput)` 替换为：

  ```typescript
  watch(timestampInput, () => {
    tsErrorMsg.value = '';
    const input = timestampInput.value.trim();
    if (!input) {
      if (lastActiveInput.value === 'timestamp') {
        unifiedResult.value = null;
        lastActiveInput.value = null;
      }
      return;
    }
    const unit = detectTimestampUnit(input);
    if (!unit) {
      tsErrorMsg.value = '无法识别时间戳格式，请输入 10 位（秒）或 13 位（毫秒）数字';
      if (lastActiveInput.value === 'timestamp') {
        unifiedResult.value = null;
      }
      return;
    }
    const ts = Number(input);
    const millis = unit === 's' ? ts * 1000 : ts;
    const info = timestampToDateInfo(millis, convertTimezone.value, customFormatStr.value);
    unifiedResult.value = { source: 'timestamp', ...info };
    lastActiveInput.value = 'timestamp';
    // 同步到日期输入框（使用本地时间格式）
    dateInput.value = dayjs(millis).format(DATE_DISPLAY_FORMAT);
  });
  ```

- [ ] **Step 2: 修改 `watch(dateInput)` 以同步时间戳输入框并防止循环**

  将 `// ─── 日期输入 ───` 下方的 `watch(dateInput)` 替换为：

  ```typescript
  watch(dateInput, () => {
    const input = dateInput.value.trim();
    dateErrorMsg.value = '';

    // 如果当前变化来自时间戳同步，不反向同步回时间戳框
    if (lastActiveInput.value === 'timestamp') {
      if (!input) {
        pickerValue.value = '';
      } else {
        pickerValue.value = displayToIso(input);
      }
      return;
    }

    if (!input) {
      if (lastActiveInput.value === 'date') {
        unifiedResult.value = null;
        lastActiveInput.value = null;
      }
      pickerValue.value = '';
      return;
    }

    const result = parseDateInput(input, convertTimezone.value, customFormatStr.value);
    if (result) {
      unifiedResult.value = { source: 'date', ...result };
      lastActiveInput.value = 'date';
      pickerValue.value = displayToIso(input);
      // 同步到时间戳输入框（毫秒）
      timestampInput.value = String(result.unixMillis);
    } else {
      dateErrorMsg.value = '请输入标准格式 yyyy/MM/dd HH:mm:ss';
      pickerValue.value = '';
      if (lastActiveInput.value === 'date') {
        unifiedResult.value = null;
      }
    }
  });
  ```

- [ ] **Step 3: 调整 `handleQuickTime` 同时填充两个输入框**

  将 `handleQuickTime` 替换为：

  ```typescript
  function handleQuickTime(type: QuickTimeType) {
    const millis = getQuickTimestamp(type);
    timestampInput.value = String(millis);
    dateInput.value = dayjs(millis).format(DATE_DISPLAY_FORMAT);
  }
  ```

- [ ] **Step 4: 移除 `fillNow()` 内嵌按钮但保留函数供快捷按钮复用**

  `fillNow()` 函数保持不变：

  ```typescript
  function fillNow() {
    timestampInput.value = String(Date.now());
  }
  ```

  注意：Task 1 的模板中已移除该按钮，函数本身可保留（当前未被调用，但无害）。

- [ ] **Step 5: 验证同步行为**

  Run:
  ```bash
  pnpm dev
  ```

  在浏览器中验证：
  1. 在时间戳框输入 `1700000000000`，观察日期框是否自动变为 `2023/11/14 22:13:20`。
  2. 清空时间戳框，在日期框输入 `2026/06/14 12:00:00`，观察时间戳框是否自动变为对应毫秒值。
  3. 切换时区，观察两侧是否同步更新。

- [ ] **Step 6: 提交**

  ```bash
  git add src/tools/datetime/DateTimeConverter.vue
  git commit -m "feat(datetime): 输入框双向自动同步

- 时间戳输入有效后自动同步到日期框
- 日期输入有效后自动同步到时间戳框
- 通过 lastActiveInput 防止循环更新
- 快捷按钮同时填充两个输入框

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

## Task 3: 修复默认填充逻辑以适配双向同步

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue:74-85`

- [ ] **Step 1: 修改 `onMounted` 中的默认填充**

  当前 `onMounted` 同时设置两个输入框的默认值。由于双向同步，当设置 `timestampInput` 后会触发 watch 同步到 `dateInput`，可能导致 `dateInput` 被覆盖。改为只设置时间戳框，让日期框通过同步自动填充：

  ```typescript
  onMounted(() => {
    isMounted.value = true;
    updateLiveClock();
    liveTimer = setInterval(updateLiveClock, 1000);
    // 默认用当前时间预填充时间戳框，日期框通过 watch 自动同步
    timestampInput.value = String(Date.now());
  });
  ```

  同时可以移除 `onMounted` 中用于构建日期字符串的辅助代码（`pad` 函数等），因为不再需要手动设置 `dateInput`。

- [ ] **Step 2: 验证默认状态**

  Run:
  ```bash
  pnpm dev
  ```

  刷新页面后确认：
  1. 时间戳框显示当前毫秒时间戳。
  2. 日期框自动显示当前本地时间 `yyyy/MM/dd HH:mm:ss`。
  3. 右侧结果区显示完整转换结果。

- [ ] **Step 3: 提交**

  ```bash
  git add src/tools/datetime/DateTimeConverter.vue
  git commit -m "fix(datetime): 默认填充通过双向同步自动完成

- onMounted 只设置时间戳框
- 日期框由 watch 同步自动填充
- 移除不再需要的日期字符串构建代码

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

## Task 4: 最终验证与清理

**Files:**
- Modify: `src/tools/datetime/DateTimeConverter.vue`

- [ ] **Step 1: 检查未使用的导入和函数**

  检查 `<script setup>` 顶部导入：
  - `CopyButton` 是否被导入（Task 1 模板中使用了，应该已导入）。
  - `fillNow` 函数如果不再被调用，可以保留或删除。建议保留，因为 `QUICK_TIME_OPTIONS` 中的"现在"本质上就是 fillNow 的语义。

  运行构建检查：
  ```bash
  pnpm build
  ```

  Expected: 构建成功，无 TypeScript 错误。

- [ ] **Step 2: 手动验证完整场景**

  Run:
  ```bash
  pnpm dev
  ```

  验证以下场景：
  1. 页面加载后两个输入框都有默认值且右侧结果正确。
  2. 修改时间戳框，日期框和结果同步更新。
  3. 修改日期框，时间戳框和结果同步更新。
  4. 输入错误的时间戳，时间戳卡片下方显示错误，日期框不被清空。
  5. 输入错误的日期，日期卡片下方显示错误，时间戳框不被清空。
  6. 点击"清空"，两个输入框、结果、错误信息全部清空。
  7. 点击快捷按钮（现在、昨天、今天、明天），两个输入框同时变化。
  8. 点击日期卡片的"选择"按钮，日期选择器正常弹出并同步两个输入框。
  9. 点击复制按钮，剪贴板内容正确。
  10. 切换桌面/移动端视口，布局正确切换（桌面并排，移动堆叠）。

- [ ] **Step 3: 提交最终版本**

  ```bash
  git add src/tools/datetime/DateTimeConverter.vue
  git commit -m "refactor(datetime): 完成输入框样式与同步重构

- 双卡片对称布局
- 双向自动同步
- 固定错误占位避免布局跳动
- 响应式适配桌面与移动端

Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

## Self-Review

### Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 视觉一致性：双卡片对称结构 | Task 1 |
| 互转关系表达：双向自动同步 | Task 2 |
| 快捷按钮同时填充两个输入框 | Task 2 |
| 去掉时间戳内嵌"当前"按钮 | Task 1 |
| 固定错误占位避免跳动 | Task 1 |
| 无 hover 样式 | Task 1 样式表 |
| 优先使用 grid 布局 | Task 1 |
| 响应式适配 | Task 1、Task 4 |

### Placeholder Scan

- 无 TBD / TODO。
- 所有代码块为完整可运行代码。
- 所有命令包含预期输出。

### Type Consistency

- `lastActiveInput` 类型保持 `'timestamp' | 'date' | null`。
- `DATE_DISPLAY_FORMAT` 已定义于脚本中，可直接用于 `dayjs().format()`。
- `getQuickTimestamp` 返回毫秒时间戳，与现有类型一致。

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-14-datetime-converter-input-refactor.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
