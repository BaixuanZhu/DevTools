<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
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

const expression = ref('* * * * *');
const errorMsg = ref('');
const executions = ref<string[]>([]);

/** 7 个字段的构建状态 */
const fields = ref<Record<keyof CronFields7, FieldState>>({
  ...DEFAULT_FIELDS_7,
});

/** 防止字段更新与表达式更新形成循环 */
let isFieldUpdateInProgress = false;

/** 表达式输入防抖计时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// =============================================================================
// 计算属性
// =============================================================================

/** 执行时间复制文本 */
const copyExecutions = computed(() => {
  return executions.value.map((t, i) => `#${i + 1}  ${t}`).join('\n');
});

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
 */
function syncFromExpression(expr: string) {
  const parsed = getFieldsFromExpression(expr);
  for (const key of FIELD_KEYS) {
    fields.value[key] = parseFieldValue(parsed[key]);
  }
  parseExpression();
}

/**
 * 防抖执行表达式到字段的同步
 */
function debouncedSyncFromExpression(expr: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => syncFromExpression(expr), 500);
}

// =============================================================================
// Watch
// =============================================================================

/** 字段变化 → 构建表达式 → 解析 */
watch(
  fields,
  () => {
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
  { deep: true },
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
  fields.value[key] = { mode };
}

/**
 * 获取指定字段的模式选项（标签根据字段类型动态调整）
 * @param config 字段配置
 */
function getModeOptions(config: FieldConfig) {
  const modes: FieldMode[] = ['every', 'range', 'step', 'specific'];
  return modes.map((mode) => ({
    value: mode,
    label: getModeLabel(config.key, mode),
  }));
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
    fields.value[key] = { mode: 'every' };
  }
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

    <!-- 构建器区域：最宽，优先展示 -->
    <section class="mt-6 px-4">
      <div class="max-w-[1400px] mx-auto">
        <label class="block text-[0.8125rem] text-muted font-medium mb-3">
          可视化构建器
        </label>
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
        >
          <div
            v-for="config in FIELD_CONFIGS"
            :key="config.key"
            class="bg-card border border-border rounded-sm p-5"
          >
            <!-- 卡片头 -->
            <div
              class="flex justify-between items-center pb-3 mb-3 border-b border-border"
            >
              <span class="font-medium text-base text-text">
                {{ config.label }}
              </span>
              <code
                class="text-sm font-mono text-accent bg-surface px-2 py-0.5 rounded-sm"
              >
                {{ fieldValuePreview[config.key] }}
              </code>
            </div>

            <!-- 模式单选 -->
            <OptionRadioGroup
              :model-value="fields[config.key].mode"
              :options="getModeOptions(config)"
              @update:model-value="(mode) => setFieldMode(config.key, mode as FieldMode)"
            />

            <!-- 参数区 -->
            <div class="mt-4 min-h-[48px]">
              <!-- 任意模式 -->
              <div
                v-if="fields[config.key].mode === 'every'"
                class="text-sm text-muted"
              >
                {{ getModeLabel(config.key, 'every') }}
              </div>

              <!-- 周期模式 -->
              <div
                v-else-if="fields[config.key].mode === 'range'"
                class="flex items-center gap-2"
              >
                <span class="text-sm text-muted shrink-0">从</span>
                <input
                  type="number"
                  :min="config.min"
                  :max="config.max"
                  :value="fields[config.key].rangeStart ?? ''"
                  class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                  placeholder="0"
                  @input="fields[config.key].rangeStart = clampValue(config, toNum(($event.target as HTMLInputElement).value))"
                />
                <span class="text-muted text-sm">到</span>
                <input
                  type="number"
                  :min="config.min"
                  :max="config.max"
                  :value="fields[config.key].rangeEnd ?? ''"
                  class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                  placeholder="0"
                  @input="fields[config.key].rangeEnd = clampValue(config, toNum(($event.target as HTMLInputElement).value))"
                />
              </div>

              <!-- 从X每Y模式 -->
              <div
                v-else-if="fields[config.key].mode === 'step'"
                class="flex flex-col gap-2"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sm text-muted shrink-0">从</span>
                  <input
                    type="number"
                    :min="config.min"
                    :max="config.max"
                    :value="fields[config.key].stepStart ?? ''"
                    class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                    placeholder="0"
                    @input="fields[config.key].stepStart = clampValue(config, toNum(($event.target as HTMLInputElement).value))"
                  />
                  <span class="text-sm text-muted shrink-0">开始</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm text-muted shrink-0">每</span>
                  <input
                    type="number"
                    :min="1"
                    :value="fields[config.key].stepInterval ?? ''"
                    class="w-20 px-2 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                    placeholder="1"
                    @input="fields[config.key].stepInterval = Math.max(1, toNum(($event.target as HTMLInputElement).value) ?? 1)"
                  />
                  <span class="text-sm text-muted shrink-0">{{ config.label }}一次</span>
                </div>
              </div>

              <!-- 指定值模式 -->
              <div
                v-else-if="fields[config.key].mode === 'specific'"
                class="flex flex-col gap-1"
              >
                <input
                  type="text"
                  :value="fields[config.key].specificValues?.join(',') ?? ''"
                  class="w-full px-3 py-1.5 border border-border rounded-sm text-sm font-mono text-text bg-card focus:outline-none focus:border-accent"
                  :placeholder="`逗号分隔，如 ${config.min},${config.min + 1},${config.min + 2}`"
                  @input="fields[config.key].specificValues = ($event.target as HTMLInputElement).value
                    .split(',')
                    .map(v => parseInt(v.trim(), 10))
                    .filter(n => !isNaN(n) && n >= config.min && n <= config.max)
                    .filter((n, i, arr) => arr.indexOf(n) === i)
                    .sort((a, b) => a - b)"
                />
                <span class="text-[0.75rem] text-muted">
                  有效范围 {{ config.min }} ~ {{ config.max }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 输入区与模板 -->
    <section class="mt-6 pt-6 border-t border-border px-4">
      <div class="max-w-[720px] mx-auto">
        <!-- Cron 表达式输入 -->
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">
            Cron 表达式
          </label>
          <div class="flex gap-2">
            <input
              v-model="expression"
              class="flex-1 px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card box-border focus:outline-none focus:border-accent"
              placeholder="*/5 * * * *"
            />
            <CopyButton :text="expression" />
            <ClearButton @clear="handleClear" />
          </div>
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-3">{{ errorMsg }}</p>

        <!-- 常用模板 -->
        <div>
          <label class="block text-[0.8125rem] text-muted font-medium mb-2">
            常用模板
          </label>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="template in CRON_TEMPLATES"
              :key="template.expression"
              class="px-2 py-1.5 border border-border rounded-sm bg-surface text-muted text-xs font-sans cursor-pointer transition-colors duration-100 hover:bg-hover hover:text-text"
              @click="handleTemplate(template)"
            >
              {{ template.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 下次执行时间 -->
    <section class="mt-6 pt-6 border-t border-border px-4">
      <div class="max-w-[720px] mx-auto">
        <div v-if="executions.length">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold m-0 text-text">下次执行时间</h3>
            <CopyButton :text="copyExecutions" label="复制列表" />
          </div>
          <div class="flex flex-col gap-1">
            <div
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
            </div>
          </div>
        </div>
        <div
          v-else-if="!errorMsg"
          class="px-4 py-6 border border-border rounded-sm bg-card text-center"
        >
          <p class="text-muted text-sm m-0">输入有效的 Cron 表达式以查看执行时间</p>
        </div>
      </div>
    </section>

    <!-- Cron 语法说明 -->
    <section class="mt-6 pt-6 border-t border-border px-4 pb-8">
      <div class="max-w-[720px] mx-auto">
        <h2 class="text-lg font-medium text-text mb-4">Cron 语法说明</h2>

        <!-- 概述 -->
        <div class="bg-card border border-border rounded-sm p-4 mb-4">
          <p class="text-sm text-text m-0 mb-3">
            Cron 表达式由 <strong>5 ~ 7 个字段</strong>组成，以空格分隔。本工具支持标准 5 字段格式（Unix Cron）以及带秒和年的扩展格式（Quartz Cron）。
          </p>
          <p class="text-sm text-text m-0">
            当<strong>秒字段为 <code class="font-mono text-accent">*</code></strong>时，表达式自动省略秒字段（显示 5 或 6 字段）；当<strong>年字段为 <code class="font-mono text-accent">*</code></strong>时，自动省略年字段，保持表达式简洁。
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
                  <th class="text-left py-2 font-medium text-muted">说明</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">秒</td>
                  <td class="py-2 pr-4 text-muted">可选</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 59</td>
                  <td class="py-2 text-muted">省略时默认为 <code class="font-mono text-accent">*</code></td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">分</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 59</td>
                  <td class="py-2 text-muted"></td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">时</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 23</td>
                  <td class="py-2 text-muted">24 小时制</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">日</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">1 ~ 31</td>
                  <td class="py-2 text-muted">每月第几天</td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">月</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">1 ~ 12</td>
                  <td class="py-2 text-muted"></td>
                </tr>
                <tr class="border-b border-border/50">
                  <td class="py-2 pr-4 font-mono text-text">周</td>
                  <td class="py-2 pr-4 text-muted">必填</td>
                  <td class="py-2 pr-4 font-mono text-text">0 ~ 6</td>
                  <td class="py-2 text-muted">0 = 周日，1 = 周一</td>
                </tr>
                <tr>
                  <td class="py-2 pr-4 font-mono text-text">年</td>
                  <td class="py-2 pr-4 text-muted">可选</td>
                  <td class="py-2 pr-4 font-mono text-text">1970 ~ 2099</td>
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
                  如 <code class="font-mono">1-5</code> 表示 1、2、3、4、5。必须满足 起始 ≤ 结束。
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
                  如 <code class="font-mono">0/5</code> 表示从 0 开始每 5 个单位（0, 5, 10...）。<code class="font-mono">*/5</code> 等价于 <code class="font-mono">0/5</code>。
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 注意事项 -->
        <div class="bg-card border border-border rounded-sm p-4 mb-4">
          <h3 class="text-sm font-semibold text-text m-0 mb-3">注意事项</h3>
          <ul class="text-sm text-muted m-0 pl-4 space-y-2">
            <li>
              <strong class="text-text">日字段与周字段的关系</strong>：两者是"与"的关系（同时满足）。例如 <code class="font-mono">0 0 1 * 1</code> 表示"每月 1 日且是周一"才执行，而不是"每月 1 日或周一"。
            </li>
            <li>
              <strong class="text-text">周字段的 0 与 7</strong>：在标准 Cron 中，0 和 7 都表示周日。本工具统一使用 0 表示周日。
            </li>
            <li>
              <strong class="text-text">月天数不一致</strong>：例如指定每月 31 日执行，则 2 月、4 月、6 月等只有 30 天的月份不会触发。
            </li>
            <li>
              <strong class="text-text">步长起始值</strong>：<code class="font-mono">1/5</code> 与 <code class="font-mono">0/5</code> 不同，前者产生 1, 6, 11...，后者产生 0, 5, 10...。
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
                <tr>
                  <td class="py-2 pr-4 font-mono text-text">0 0 * * 1</td>
                  <td class="py-2 text-muted">每周一零点执行</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
