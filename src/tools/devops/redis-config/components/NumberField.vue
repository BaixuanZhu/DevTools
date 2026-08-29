<script setup lang="ts">
/**
 * 数值输入框（本工具私有形态组件）：数字输入 + 推荐快捷选项 chips。
 *
 * 输入解析成功即 emit（解析失败不 emit，避免清空过程中误写值）；
 * 失焦时把值 clamp 到 [min, max]，空值/非法恢复为当前绑定值。
 * 快捷选项点击 emit clamp 后的值，当前值命中的选项高亮。
 */
import { ref, watch } from 'vue';

/** 推荐快捷选项：value 为写入值，label 为档位名（如 '推荐'，缺省仅显示数值） */
export interface NumberQuickOption {
  value: number;
  label?: string;
}

const props = withDefaults(
  defineProps<{
    /** 当前值 */
    modelValue: number;
    /** 允许的最小值（失焦 clamp 下界） */
    min?: number;
    /** 允许的最大值（失焦 clamp 上界） */
    max?: number;
    /** 原生步长（透传 input，供方向键增量） */
    step?: number;
    /** 值单位（输入框右侧灰字后缀，如 'mb' / '秒'） */
    unit?: string;
    /** 推荐快捷选项（输入框下方一排小按钮） */
    quickOptions?: NumberQuickOption[];
    /** 无障碍名（aria-label，绑定到输入框） */
    label?: string;
  }>(),
  { min: undefined, max: undefined, step: undefined, unit: undefined, quickOptions: undefined, label: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

/** 输入框草稿：允许中间态（空串/越界），失焦或外部值回写时归一 */
const draft = ref(String(props.modelValue));

/** 解析草稿为数值，空串/非法返回 null */
function parseDraft(): number | null {
  const text = draft.value.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** 夹取到 [min, max]（未提供边界则不约束） */
function clamp(value: number): number {
  if (props.min !== undefined && value < props.min) return props.min;
  if (props.max !== undefined && value > props.max) return props.max;
  return value;
}

watch(
  () => props.modelValue,
  (v) => {
    // 草稿解析结果与外部值一致时（正在输入）不打断，否则同步（含快捷选项/重置回写）
    if (parseDraft() !== v) draft.value = String(v);
  },
);

function onInput(event: Event): void {
  // 不用 v-model：number 输入的 v-model 会把草稿转成 number，丢失空串等中间态
  draft.value = (event.target as HTMLInputElement).value;
  const n = parseDraft();
  if (n !== null) emit('update:modelValue', n);
}

function onBlur(): void {
  const n = parseDraft();
  if (n === null) {
    // 空值/非法：恢复为当前绑定值
    draft.value = String(props.modelValue);
    return;
  }
  const clamped = clamp(n);
  if (clamped !== n) {
    draft.value = String(clamped);
    emit('update:modelValue', clamped);
  }
}

/**
 * 点击快捷选项：emit clamp 后的值（草稿由 modelValue watch 同步）。
 * @param option - 被点选项
 */
function pick(option: NumberQuickOption): void {
  emit('update:modelValue', clamp(option.value));
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-2">
      <input
        :value="draft"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="label"
        class="w-full min-w-0 flex-1 rounded-sm border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
        @input="onInput"
        @blur="onBlur"
      />
      <span v-if="unit" class="shrink-0 text-[0.8125rem] text-muted-foreground">{{ unit }}</span>
    </div>

    <!-- 推荐快捷选项：当前值命中的按钮高亮 -->
    <div v-if="quickOptions?.length" class="flex flex-wrap gap-1.5">
      <button
        v-for="option in quickOptions"
        :key="option.value"
        type="button"
        class="rounded-sm border bg-card px-2 py-0.5 text-[0.6875rem] tabular-nums transition-[background-color,color] duration-150 hover:bg-accent"
        :class="modelValue === option.value ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'"
        @click="pick(option)"
      >
        {{ option.label ? `${option.label} ${option.value}${unit ?? ''}` : `${option.value}${unit ?? ''}` }}
      </button>
    </div>
  </div>
</template>
