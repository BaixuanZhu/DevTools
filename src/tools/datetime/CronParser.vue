<script setup lang="ts">
import {ref, watch, computed, nextTick} from 'vue';
import {TabGroup, TabList, Tab, TabPanels, TabPanel} from '@headlessui/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';

import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseCronExpression,
  buildCronFromFields,
  getFieldsFromExpression,
  formatExecutionTime,
  buildFieldValue,
  parseFieldValue,
  getModeLabel,
  parseSpecificValues,
  WEEKDAY_NAMES,
  MONTH_NAMES,
  CRON_TEMPLATES,
  FIELD_CONFIGS,
  DEFAULT_FIELDS_7,
  type FieldMode,
  type FieldState,
  type CronFields7,
  type FieldConfig,
} from '../../utils/datetime/cron';

/** 7 个字段的 key 列表 */
const FIELD_KEYS: (keyof CronFields7)[] = [
  'second', 'minute', 'hour', 'day', 'month', 'dayOfWeek', 'year',
];

// =============================================================================
// 状态
// =============================================================================

const expression = ref('');
const errorMsg = ref('');
const executions = ref<string[]>([]);

/** 7 个字段的构建状态 */
const fields = ref<Record<keyof CronFields7, FieldState>>({
  ...DEFAULT_FIELDS_7,
});

/** 当前激活的字段 Tab */
const activeFieldTab = ref<keyof CronFields7>('second');

/** 防止字段更新与表达式更新形成循环 */
let isFieldUpdateInProgress = false;

/** 是否正在从表达式同步字段（防止 watch(fields) 反向覆盖 expression） */
let isSyncingFromExpression = false;

/** 表达式输入防抖计时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// =============================================================================
// 计算属性
// =============================================================================


/** 各字段当前值预览 */
const fieldValuePreview = computed(() => {
  const result: Partial<Record<keyof CronFields7, string>> = {};
  for (const key of FIELD_KEYS) {
    result[key] = buildFieldValue(fields.value[key]);
  }
  return result;
});

// =============================================================================
// 核心逻辑
// =============================================================================

/**
 * 解析当前表达式，计算执行时间
 */
function parseExpression() {
  errorMsg.value = '';
  executions.value = [];

  const trimmed = expression.value.trim();
  if (!trimmed) return;

  try {
    const result = parseCronExpression(trimmed, 5);
    executions.value = result.nextExecutions.map(formatExecutionTime);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '解析时出错';
  }
}

/**
 * 从表达式反向同步字段状态
 * @param expr Cron 表达式
 */
function syncFromExpression(expr: string) {
  isSyncingFromExpression = true;
  const parsed = getFieldsFromExpression(expr);
  for (const key of FIELD_KEYS) {
    fields.value[key] = parseFieldValue(parsed[key]);
  }
  parseExpression();
  nextTick(() => {
    isSyncingFromExpression = false;
  });
}

/**
 * 防抖执行表达式到字段的同步
 * @param expr Cron 表达式
 */
function debouncedSyncFromExpression(expr: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncFromExpression(expr), 300);
}

// =============================================================================
// Watch
// =============================================================================

/** 字段变化 → 构建表达式 → 解析 */
watch(
    fields,
    () => {
      // 由 syncFromExpression 触发的 fields 更新，跳过反向同步 expression
      if (isSyncingFromExpression) return;

      isFieldUpdateInProgress = true;

      const stringFields = {} as CronFields7;
      for (const key of FIELD_KEYS) {
        stringFields[key] = buildFieldValue(fields.value[key]);
      }
      expression.value = buildCronFromFields(stringFields);
      parseExpression();

      nextTick(() => {
        isFieldUpdateInProgress = false;
      });
    },
    {deep: true},
);

/** 表达式变化（用户手动输入时）→ 反向同步字段 */
watch(expression, (newExpr) => {
  if (isFieldUpdateInProgress) return;
  debouncedSyncFromExpression(newExpr);
});

// =============================================================================
// 字段操作辅助函数
// =============================================================================

/**
 * 设置字段模式，同时重置该字段的参数
 * @param key 字段 key
 * @param mode 新模式
 */
function setFieldMode(key: keyof CronFields7, mode: FieldMode) {
  fields.value[key] = {mode};
}

/**
 * 激活指定模式（不重置参数）
 * @param key 字段 key
 * @param mode 目标模式
 */
function activateMode(key: keyof CronFields7, mode: FieldMode) {
  if (fields.value[key].mode === mode) return;
  fields.value[key] = {mode};
}

/**
 * 将输入字符串转为数字，空值返回 undefined
 * @param val 输入字符串
 */
function toNum(val: string): number | undefined {
  if (val === '') return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

/**
 * 校验数字是否在字段有效范围内
 * @param config 字段配置
 * @param value 待校验值
 */
function clampValue(config: FieldConfig, value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.max(config.min, Math.min(config.max, value));
}

/**
 * 切换指定值（复选框网格用）
 * @param key 字段 key
 * @param config 字段配置
 * @param value 要切换的数值
 */
function toggleSpecificValue(key: keyof CronFields7, config: FieldConfig, value: number) {
  const current = fields.value[key].specificValues ?? [];
  const index = current.indexOf(value);
  if (index >= 0) {
    fields.value[key].specificValues = current.filter(v => v !== value);
  } else {
    fields.value[key].specificValues = [...current, value].sort((a, b) => a - b);
  }
}

/**
 * 切换到指定字段 Tab（点击字段徽标时）
 * @param key 字段 key
 */
function switchToField(key: keyof CronFields7) {
  activeFieldTab.value = key;
}

// =============================================================================
// 事件处理
// =============================================================================

/**
 * 点击常用模板
 * @param template 模板数据
 */
function handleTemplate(template: (typeof CRON_TEMPLATES)[number]) {
  expression.value = template.expression;
  syncFromExpression(template.expression);
}

/**
 * 清空所有状态
 */
function handleClear() {
  expression.value = '';
  errorMsg.value = '';
  executions.value = [];
  for (const key of FIELD_KEYS) {
    fields.value[key] = {mode: 'every'};
  }
}

/**
 * 处理指定值输入
 * @param key 字段 key
 * @param config 字段配置
 * @param event 输入事件
 */
function handleSpecificInput(key: keyof CronFields7, config: FieldConfig, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  const skipRange = key === 'year';
  fields.value[key].specificValues = parseSpecificValues(value, config.min, config.max, skipRange);
}

// =============================================================================
// 初始化
// =============================================================================

parseExpression();
</script>

<template>
  <div>
    <ToolHeader
        title="Cron 表达式解析器"
        description="解析 Cron 表达式，预览执行时间，可视化构建"
        :show-example="false"
    />

    <!-- 构建器（全宽） -->
    <section class="mt-6 px-4">
      <div class="max-w-5xl mx-auto">
        <TabGroup
            as="div"
            class="border border-border rounded-lg bg-card overflow-hidden"
            :selected-index="FIELD_KEYS.indexOf(activeFieldTab)"
            @change="(i: number) => activeFieldTab = FIELD_KEYS[i]"
        >
          <TabList class="flex gap-1 px-2 pt-2 pb-0 border-b border-border">
            <Tab v-for="config in FIELD_CONFIGS" :key="config.key" v-slot="{ selected }" as="template">
              <button
                  :class="[
                  'flex flex-col items-center gap-0.5 px-3 py-2 border border-solid rounded-t-md cursor-pointer min-w-[48px] -mb-px relative z-10',
                  'transition-[background-color,border-color] duration-150',
                  'focus:outline-none',
                  selected
                    ? 'border-accent border-b-card bg-accent/5'
                    : 'border-transparent bg-transparent hover:bg-hover',
                ]"
              >
                <span class="text-[0.8125rem] font-medium" :class="selected ? 'text-accent' : 'text-text'">
                  {{ config.label }}
                </span>
                <code class="text-[0.6875rem] font-mono" :class="selected ? 'text-accent' : 'text-muted'">
                  {{ fieldValuePreview[config.key] }}
                </code>
              </button>
            </Tab>
          </TabList>

          <TabPanels class="p-4 h-160">
            <TabPanel class="h-full" v-for="config in FIELD_CONFIGS" :key="config.key">
              <div class="flex flex-col gap-1.5 h-full overflow-y-auto">
                <div
                    v-for="mode in config.modes"
                    :key="mode"
                    @click="activateMode(config.key, mode)"
                    :class="[
                      mode === 'specific' ? 'flex items-start' : 'flex items-center',
                      'gap-3 px-3 py-2 rounded-md border cursor-pointer',
                      'transition-[background-color] duration-150',
                      fields[config.key].mode === mode
                        ? 'border-border bg-accent/5'
                        : 'border-border bg-card hover:bg-hover',
                    ]"
                >
                  <!-- 左列：Checkbox + 模式标签 -->
                  <div class="flex items-center gap-2 shrink-0" @click.stop>
                    <span
                        :class="[
                          'w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0',
                          'transition-[border-color,background-color] duration-150',
                          fields[config.key].mode === mode
                            ? 'border-accent bg-accent'
                            : 'border-border',
                        ]"
                    >
                      <svg
                          v-if="fields[config.key].mode === mode"
                          class="w-2.5 h-2.5 text-white"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                      >
                        <path d="M2.5 6L5 8.5L9.5 3.5"/>
                      </svg>
                    </span>
                    <span
                        :class="[
                          'text-sm font-medium whitespace-nowrap',
                          fields[config.key].mode === mode ? 'text-accent' : 'text-muted',
                        ]"
                    >
                      {{ getModeLabel(config.key, mode) }}
                    </span>
                  </div>

                  <!-- 右列：模式内容 -->
                  <div
                      class="flex items-center gap-2 flex-wrap flex-1 min-w-0"
                      @focusin="activateMode(config.key, mode)"
                      @click.stop
                  >
                    <!-- every 模式 -->
                    <div v-if="mode === 'every'" class="text-sm text-muted">
                      {{ getModeLabel(config.key, 'every') }}
                    </div>

                    <!-- range 模式 -->
                    <div v-else-if="mode === 'range'" class="flex items-center gap-2">
                      <span class="text-sm text-muted shrink-0">从</span>
                      <input
                          type="text"
                          :value="fields[config.key].rangeStart ?? ''"
                          :aria-label="`${config.label}范围起始值`"
                          class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                          placeholder="0"
                          @input="fields[config.key].rangeStart = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'range')"
                      />
                      <span class="text-muted text-sm">到</span>
                      <input
                          type="text"
                          :value="fields[config.key].rangeEnd ?? ''"
                          :aria-label="`${config.label}范围结束值`"
                          class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                          placeholder="0"
                          @input="fields[config.key].rangeEnd = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'range')"
                      />
                    </div>

                    <!-- step 模式 -->
                    <div v-else-if="mode === 'step'" class="flex items-center gap-2 flex-wrap">
                      <div class="flex items-center gap-2">
                        <span class="text-sm text-muted shrink-0">从</span>
                        <input
                            type="text"
                            :value="fields[config.key].stepStart ?? ''"
                            :aria-label="`${config.label}步长起始值`"
                            class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                            placeholder="0"
                            @input="fields[config.key].stepStart = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'step')"
                        />
                        <span class="text-sm text-muted shrink-0">开始，每隔</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <input
                            type="text"
                            :value="fields[config.key].stepInterval ?? ''"
                            :aria-label="`${config.label}步长间隔`"
                            class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                            placeholder="1"
                            @input="fields[config.key].stepInterval = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'step')"
                        />
                        <span class="text-sm text-muted shrink-0">{{ config.label }}</span>
                      </div>
                    </div>

                    <!-- specific 模式 -->
                    <div v-else-if="mode === 'specific'" class="w-full">
                      <!-- 秒/分 (0-59, 10列) -->
                      <div v-if="config.key === 'second' || config.key === 'minute'">
                        <div class="grid grid-cols-10 gap-1">
                          <button
                              v-for="i in 60"
                              :key="i - 1"
                              @click="toggleSpecificValue(config.key, config, i - 1); activateMode(config.key, 'specific')"
                              :class="[
                                'px-1 py-1 border rounded-sm text-xs font-mono cursor-pointer transition-[background-color,border-color] duration-150',
                                (fields[config.key].specificValues ?? []).includes(i - 1)
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-surface text-text border-border hover:bg-hover',
                              ]"
                          >
                            {{ i - 1 }}
                          </button>
                        </div>
                      </div>

                      <!-- 时 (0-23, 8列) -->
                      <div v-else-if="config.key === 'hour'">
                        <div class="grid grid-cols-8 gap-1">
                          <button
                              v-for="i in 24"
                              :key="i - 1"
                              @click="toggleSpecificValue(config.key, config, i - 1); activateMode(config.key, 'specific')"
                              :class="[
                                'px-1 py-1 border rounded-sm text-xs font-mono cursor-pointer transition-[background-color,border-color] duration-150',
                                (fields[config.key].specificValues ?? []).includes(i - 1)
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-surface text-text border-border hover:bg-hover',
                              ]"
                          >
                            {{ i - 1 }}
                          </button>
                        </div>
                      </div>

                      <!-- 日 (1-31, 7列) -->
                      <div v-else-if="config.key === 'day'">
                        <div class="grid grid-cols-7 gap-1">
                          <button
                              v-for="i in 31"
                              :key="i"
                              @click="toggleSpecificValue(config.key, config, i); activateMode(config.key, 'specific')"
                              :class="[
                                'px-1 py-1 border rounded-sm text-xs font-mono cursor-pointer transition-[background-color,border-color] duration-150',
                                (fields[config.key].specificValues ?? []).includes(i)
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-surface text-text border-border hover:bg-hover',
                              ]"
                          >
                            {{ i }}
                          </button>
                        </div>
                      </div>

                      <!-- 月 (1-12, 6列, 显示月份名) -->
                      <div v-else-if="config.key === 'month'">
                        <div class="grid grid-cols-6 gap-1">
                          <button
                              v-for="i in 12"
                              :key="i"
                              @click="toggleSpecificValue(config.key, config, i); activateMode(config.key, 'specific')"
                              :class="[
                                'px-2 py-1.5 border rounded-sm text-xs font-sans cursor-pointer transition-[background-color,border-color] duration-150',
                                (fields[config.key].specificValues ?? []).includes(i)
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-surface text-text border-border hover:bg-hover',
                              ]"
                          >
                            {{ MONTH_NAMES[i - 1] }}
                          </button>
                        </div>
                      </div>

                      <!-- 周 (7个按钮, 显示星期名) -->
                      <div v-else-if="config.key === 'dayOfWeek'">
                        <div class="grid grid-cols-7 gap-1">
                          <button
                              v-for="(name, idx) in WEEKDAY_NAMES"
                              :key="idx"
                              @click="toggleSpecificValue(config.key, config, idx); activateMode(config.key, 'specific')"
                              :class="[
                                'px-2 py-1.5 border rounded-sm text-xs font-sans cursor-pointer transition-[background-color,border-color] duration-150',
                                (fields[config.key].specificValues ?? []).includes(idx)
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-surface text-text border-border hover:bg-hover',
                              ]"
                          >
                            {{ name }}
                          </button>
                        </div>
                      </div>

                      <!-- 年 (文本输入，不限制范围) -->
                      <div v-else-if="config.key === 'year'" class="flex items-center gap-2">
                        <input
                            type="text"
                            :value="fields[config.key].specificValues?.join(',') ?? ''"
                            :aria-label="`${config.label}指定值`"
                            class="w-full px-3 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                            placeholder="逗号分隔，如 2024,2025,2026"
                            @input="handleSpecificInput(config.key, config, $event); activateMode(config.key, 'specific')"
                        />
                      </div>
                    </div>

                    <!-- lastDay 模式 (L) -->
                    <div v-else-if="mode === 'lastDay'" class="text-sm text-muted">
                      每月最后一天 (L)
                    </div>

                    <!-- lastNDay 模式 (L-N) -->
                    <div v-else-if="mode === 'lastNDay'" class="flex items-center gap-2">
                      <span class="text-sm text-muted shrink-0">倒数第</span>
                      <input
                          type="text"
                          :value="fields[config.key].lastN ?? ''"
                          aria-label="倒数天数"
                          class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                          @input="fields[config.key].lastN = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'lastNDay')"
                      />
                      <span class="text-sm text-muted shrink-0">天</span>
                    </div>

                    <!-- nearWeekday 模式 (W) -->
                    <div v-else-if="mode === 'nearWeekday'" class="flex items-center gap-2">
                      <span class="text-sm text-muted shrink-0">每月第</span>
                      <input
                          type="text"
                          :value="fields[config.key].nearWDay ?? ''"
                          aria-label="最近工作日的日期"
                          class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                          @input="fields[config.key].nearWDay = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'nearWeekday')"
                      />
                      <span class="text-sm text-muted shrink-0">日最近的工作日 (W)</span>
                    </div>

                    <!-- lastWeekday 模式 (LW) -->
                    <div v-else-if="mode === 'lastWeekday'" class="text-sm text-muted">
                      每月最后一个工作日 (LW)
                    </div>

                    <!-- lastN 模式 (最后一个周X) -->
                    <div v-else-if="mode === 'lastN'" class="flex items-center gap-2">
                      <span class="text-sm text-muted shrink-0">最后一个</span>
                      <select
                          :value="fields[config.key].nthDayWeekday ?? 0"
                          aria-label="星期几"
                          class="px-2 py-1.5 border border-border rounded-sm text-sm font-sans text-text bg-card focus:outline-none focus:border-accent"
                          @change="fields[config.key].nthDayWeekday = toNum(($event.target as HTMLSelectElement).value); activateMode(config.key, 'lastN')"
                      >
                        <option v-for="(name, idx) in WEEKDAY_NAMES" :key="idx" :value="idx">{{ name }}</option>
                      </select>
                    </div>

                    <!-- nthDay 模式 (第N个周X) -->
                    <div v-else-if="mode === 'nthDay'" class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm text-muted shrink-0">第</span>
                      <input
                          type="text"
                          :value="fields[config.key].nthDayN ?? ''"
                          aria-label="第几个"
                          class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                          @input="fields[config.key].nthDayN = toNum(($event.target as HTMLInputElement).value); activateMode(config.key, 'nthDay')"
                      />
                      <span class="text-sm text-muted shrink-0">个</span>
                      <select
                          :value="fields[config.key].nthDayWeekday ?? 0"
                          aria-label="星期几"
                          class="px-2 py-1.5 border border-border rounded-sm text-sm font-sans text-text bg-card focus:outline-none focus:border-accent"
                          @change="fields[config.key].nthDayWeekday = toNum(($event.target as HTMLSelectElement).value); activateMode(config.key, 'nthDay')"
                      >
                        <option v-for="(name, idx) in WEEKDAY_NAMES" :key="idx" :value="idx">{{ name }}</option>
                      </select>
                    </div>

                    <!-- 兜底 -->
                    <div v-else class="text-sm text-muted"></div>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </section>

    <!-- 表达式输入（全宽） -->
    <section class="mt-6 px-4" aria-labelledby="expression-label">
      <div class="max-w-5xl mx-auto">
        <!-- 输入行 -->
        <label id="expression-label" for="cron-expression" class="block text-[0.8125rem] text-muted font-medium mb-1">
          Cron 表达式
        </label>
        <div class="flex gap-2">
          <input
              id="cron-expression"
              v-model="expression"
              class="flex-1 px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              placeholder="*/5 * * * *"
          />
          <CopyButton :text="expression"/>
          <ClearButton @clear="handleClear"/>
        </div>

        <!-- 错误信息 -->
        <p v-if="errorMsg" role="alert" class="text-error text-[0.8125rem] m-0 mt-2">{{ errorMsg }}</p>

        <!-- 模板按钮 -->
        <div class="mt-4">
          <label class="block text-[0.8125rem] text-muted font-medium mb-2">常用模板</label>
          <div class="flex flex-wrap gap-2">
            <button
                v-for="template in CRON_TEMPLATES"
                :key="template.expression"
                class="px-3 py-1.5 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-[background-color,color,border-color] duration-150 hover:bg-hover hover:text-text"
                @click="handleTemplate(template)"
            >
              {{ template.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 执行时间（全宽） -->
    <section class="mt-6 px-4">
      <div class="max-w-5xl mx-auto">
        <div v-if="executions.length">
          <h3 class="text-sm font-semibold mb-2 text-text">下次执行时间</h3>
          <ol class="flex flex-col gap-1 list-none m-0 p-0" aria-label="执行时间列表">
            <li
                v-for="(time, index) in executions"
                :key="index"
                class="flex items-center gap-3 px-4 py-2 border border-border rounded-sm bg-card"
            >
              <span class="text-xs font-semibold text-accent min-w-[32px] shrink-0">
                #{{ index + 1 }}
              </span>
              <code class="flex-1 font-mono text-[0.8125rem] text-text select-all">
                {{ time }}
              </code>
            </li>
          </ol>
        </div>
        <div
            v-else-if="!errorMsg"
            class="px-4 py-6 border border-border rounded-sm bg-card text-center"
        >
          <p class="text-muted text-sm m-0">输入有效的 Cron 表达式以查看执行时间</p>
        </div>
      </div>
    </section>

    <!-- 语法说明（独立全宽模块） -->
    <section class="mt-6 px-4 pb-8">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-sm font-semibold text-text mb-3">Cron 语法说明</h2>
        <div>
          <!-- 概述 -->
          <div class="bg-card border border-border rounded-sm p-4 mb-4">
            <p class="text-sm text-text m-0 mb-3">
              Cron 表达式由 <strong>5 ~ 7 个字段</strong>组成，以空格分隔。本工具支持标准 5 字段格式（Unix
              Cron）以及带秒和年的扩展格式（Quartz Cron）。
            </p>
            <p class="text-sm text-text m-0">
              当<strong>秒字段为 <code class="font-mono text-accent">*</code></strong>时，表达式自动省略秒字段（显示 5 或
              6 字段）；当<strong>年字段为 <code class="font-mono text-accent">*</code></strong>时，自动省略年字段，保持表达式简洁。
            </p>
          </div>

          <!-- 字段表格 -->
          <div class="bg-card border border-border rounded-sm p-4 mb-4">
            <h3 class="text-sm font-semibold text-text m-0 mb-3">字段定义</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                <tr class="border-b border-border">
                  <th class="text-left py-2 pr-4 font-medium text-muted">字段</th>
                  <th class="text-left py-2 pr-4 font-medium text-muted">必填</th>
                  <th class="text-left py-2 pr-4 font-medium text-muted">允许值</th>
                  <th class="text-left py-2 pr-4 font-medium text-muted">特殊字符</th>
                  <th class="text-left py-2 font-medium text-muted">说明</th>
                </tr>
                </thead>
                <tbody>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">秒</td>
                  <td class="py-2 pr-4 text-muted">可选</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 59</td>
                  <td class="py-2 pr-4 text-muted">—</td>
                  <td class="py-2 text-muted">省略时默认为 <code class="font-mono text-accent">*</code></td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">分</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 59</td>
                  <td class="py-2 pr-4 text-muted">—</td>
                  <td class="py-2 text-muted">每分钟的第几分执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">时</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 23</td>
                  <td class="py-2 pr-4 text-muted">—</td>
                  <td class="py-2 text-muted">24 小时制</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">日</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">1 ~ 31</td>
                  <td class="py-2 pr-4">
                    <code class="font-mono text-accent text-xs">L</code>
                    <code class="font-mono text-accent text-xs ml-1">W</code>
                    <code class="font-mono text-accent text-xs ml-1">LW</code>
                  </td>
                  <td class="py-2 text-muted">每月第几天</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">月</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">1 ~ 12</td>
                  <td class="py-2 pr-4 text-muted">—</td>
                  <td class="py-2 text-muted">月份，1 = 一月</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">周</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 6</td>
                  <td class="py-2 pr-4">
                    <code class="font-mono text-accent text-xs">L</code>
                    <code class="font-mono text-accent text-xs ml-1">#</code>
                  </td>
                  <td class="py-2 text-muted">0 = 周日，1 = 周一</td>
                </tr>
                <tr>
                  <td class="py-2 pr-4 font-mono text-text">年</td>
                  <td class="py-2 pr-4 text-muted">可选</td>
                  <td class="py-2 pr-4 font-mono text-text">1970 ~ 2099</td>
                  <td class="py-2 pr-4 text-muted">—</td>
                  <td class="py-2 text-muted">省略时默认为 <code class="font-mono text-accent">*</code></td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 通配符 -->
          <div class="bg-card border border-border rounded-sm p-4 mb-4">
            <h3 class="text-sm font-semibold text-text m-0 mb-3">通配符说明</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">*</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">匹配任意值</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    表示该字段的每一个有效值都匹配，如分字段的 <code class="font-mono">*</code> 表示每分钟。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">-</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">指定范围</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    如 <code class="font-mono">1-5</code> 表示 1、2、3、4、5。必须满足 起始 &le; 结束。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">,</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">指定多个值</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    如 <code class="font-mono">1,3,5</code> 表示 1、3、5 三个值，值的顺序不影响结果。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">/</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">指定步长</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    如 <code class="font-mono">0/5</code> 表示从 0 开始每 5 个单位（0, 5, 10...）。<code class="font-mono">*/5</code>
                    等价于 <code class="font-mono">0/5</code>。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 特殊字符说明 -->
          <div class="bg-card border border-border rounded-sm p-4 mb-4">
            <h3 class="text-sm font-semibold text-text m-0 mb-3">特殊字符说明</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">L</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">最后 (Last)</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    日字段：表示月末最后一天。周字段：表示该星期最后一次出现，如 <code class="font-mono">5L</code> = 最后一个周五。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">W</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">最近工作日</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    仅日字段。如 <code class="font-mono">15W</code> 表示离 15 号最近的工作日。若 15 号是周六则取周五 14
                    号，是周日则取周一 16 号。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">LW</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">最后工作日</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    仅日字段。表示每月最后一个工作日（周一至周五）。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">L-N</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">倒数第 N 天</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    仅日字段。如 <code class="font-mono">L-3</code> 表示月末倒数第 3 天。
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <code class="shrink-0 font-mono text-accent bg-surface px-2 py-1 rounded-sm text-sm">#</code>
                <div>
                  <p class="text-sm font-medium text-text m-0">第 N 个星期 X</p>
                  <p class="text-[0.8125rem] text-muted m-0 mt-0.5">
                    仅周字段。格式 <code class="font-mono">X#N</code>，如 <code class="font-mono">1#3</code> = 第 3 个周一。N
                    范围 1~5。
                  </p>
                </div>
              </div>
            </div>
            <div class="mt-4 pt-3 border-t border-border/50">
              <p class="text-[0.8125rem] text-muted m-0">
                <strong class="text-text">可用范围：</strong>
                <code class="font-mono text-xs">L</code>、<code class="font-mono text-xs">W</code>、<code
                  class="font-mono text-xs">LW</code>、<code class="font-mono text-xs">L-N</code> 仅日字段；
                <code class="font-mono text-xs">L</code>、<code class="font-mono text-xs">#</code> 仅周字段。
              </p>
            </div>
          </div>

          <!-- 注意事项 -->
          <div class="bg-card border border-border rounded-sm p-4 mb-4">
            <h3 class="text-sm font-semibold text-text m-0 mb-3">注意事项</h3>
            <ul class="text-sm text-muted m-0 pl-4 space-y-2">
              <li>
                <strong class="text-text">日字段与周字段的关系</strong>：两者是"与"的关系（同时满足）。例如 <code
                  class="font-mono">0 0 1 * 1</code> 表示"每月 1 日且是周一"才执行，而不是"每月 1 日或周一"。
              </li>
              <li>
                <strong class="text-text">周字段的 0 与 7</strong>：在标准 Cron 中，0 和 7 都表示周日。本工具统一使用 0
                表示周日。
              </li>
              <li>
                <strong class="text-text">月天数不一致</strong>：例如指定每月 31 日执行，则 2 月、4 月、6 月等只有 30
                天的月份不会触发。
              </li>
              <li>
                <strong class="text-text">步长起始值</strong>：<code class="font-mono">1/5</code> 与 <code
                  class="font-mono">0/5</code> 不同，前者产生 1, 6, 11...，后者产生 0, 5, 10...。
              </li>
            </ul>
          </div>

          <!-- 常用示例 -->
          <div class="bg-card border border-border rounded-sm p-4">
            <h3 class="text-sm font-semibold text-text m-0 mb-3">常用示例</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                <tr class="border-b border-border">
                  <th class="text-left py-2 pr-4 font-medium text-muted">表达式</th>
                  <th class="text-left py-2 font-medium text-muted">含义</th>
                </tr>
                </thead>
                <tbody>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 * * *</td>
                  <td class="py-2 text-muted">每天零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">*/5 * * * *</td>
                  <td class="py-2 text-muted">每 5 分钟执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 9 * * 1-5</td>
                  <td class="py-2 text-muted">工作日每天 9 点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 1 * *</td>
                  <td class="py-2 text-muted">每月 1 日零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 * * 0</td>
                  <td class="py-2 text-muted">每周日零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 1 1 *</td>
                  <td class="py-2 text-muted">每年 1 月 1 日零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">30 2 * * *</td>
                  <td class="py-2 text-muted">每天凌晨 2:30 执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 */6 * * *</td>
                  <td class="py-2 text-muted">每 6 小时执行一次</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 9,18 * * *</td>
                  <td class="py-2 text-muted">每天 9 点和 18 点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 * * 1</td>
                  <td class="py-2 text-muted">每周一零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 L * *</td>
                  <td class="py-2 text-muted">每月最后一天零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 1W * *</td>
                  <td class="py-2 text-muted">每月 1 号最近工作日零点执行</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">0 0 * * 1#2</td>
                  <td class="py-2 text-muted">每月第 2 个周一零点执行</td>
                </tr>
                <tr>
                  <td class="py-2 pr-4 font-mono text-text">0 0 LW * *</td>
                  <td class="py-2 text-muted">每月最后一个工作日零点执行</td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
