<script setup lang="ts">
/**
 * 连续数值参数的滑块控件（本工具私有形态组件）。
 *
 * 上半部是原生 range 输入（accent-primary 着色），下半部是
 * "保守 / 推荐 / 激进"三段刻度条与当前值落点：
 * - range 三项均为数字时按值定位分段边界，推荐值画刻度线；
 * - range 为字符串描述（相对量如 '60% 内存'）或未提供时退化为等宽分段/纯轨道；
 * - 当前值落在 [保守, 激进] 区间之外时数值警示着色。
 */
import { computed } from 'vue';
import type { ParamRange } from '../params';

const props = withDefaults(
  defineProps<{
    /** 当前值 */
    modelValue: number;
    /** 最小值 */
    min: number;
    /** 最大值 */
    max: number;
    /** 步长 */
    step: number;
    /** 推荐范围刻度；无则渲染纯轨道 */
    range?: ParamRange | null;
    /** 值单位（展示用，如 'mb' / '秒'） */
    unit?: string;
    /** 无障碍名（aria-label，绑定到 range 输入；不产生视觉变化） */
    label?: string;
  }>(),
  { range: null, unit: undefined, label: undefined },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

/** range 三项均为数字时返回数值形态，否则 null */
const numeric = computed<{ c: number; r: number; a: number } | null>(() => {
  const r = props.range;
  if (!r) return null;
  if (
    typeof r.conservative === 'number' &&
    typeof r.recommended === 'number' &&
    typeof r.aggressive === 'number'
  ) {
    return { c: r.conservative, r: r.recommended, a: r.aggressive };
  }
  return null;
});

/** 值 → 轨道百分比落点（截断到 0~100） */
function toPercent(value: number): number {
  const span = props.max - props.min;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((value - props.min) / span) * 100));
}

/** 当前值落点（%） */
const posPercent = computed(() => toPercent(props.modelValue));

/** 保守/激进分段边界（%） */
const bounds = computed(() => {
  if (!numeric.value) return null;
  const c = toPercent(numeric.value.c);
  const a = toPercent(numeric.value.a);
  return { left: Math.min(c, a), right: Math.max(c, a) };
});

/** 推荐值刻度线位置（%） */
const recommendedPercent = computed(() => (numeric.value ? toPercent(numeric.value.r) : null));

/** 当前值超出 [保守, 激进] 区间时警示 */
const outOfScope = computed(() => {
  if (!numeric.value) return false;
  const { c, a } = numeric.value;
  return props.modelValue < Math.min(c, a) || props.modelValue > Math.max(c, a);
});

/** 当前值展示文本 */
const valueText = computed(() => `${props.modelValue}${props.unit ?? ''}`);

function onInput(event: Event): void {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-3">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :aria-label="label"
        class="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        :aria-valuetext="valueText"
        @input="onInput"
      />
      <span
        class="shrink-0 text-[0.8125rem] tabular-nums transition-[color] duration-150"
        :class="outOfScope ? 'text-warning font-medium' : 'text-foreground'"
        :title="outOfScope ? '当前值超出保守~激进推荐区间' : undefined"
      >
        {{ valueText }}<span v-if="outOfScope" class="ml-0.5">⚠</span>
      </span>
    </div>

    <!-- 三段刻度条 + 落点 -->
    <div class="relative h-1.5 rounded-full bg-muted">
      <template v-if="bounds">
        <div
          class="absolute inset-y-0 left-0 rounded-l-full bg-info/30"
          :style="{ width: `${bounds.left}%` }"
        />
        <div
          class="absolute inset-y-0 bg-success/30"
          :style="{ left: `${bounds.left}%`, width: `${bounds.right - bounds.left}%` }"
        />
        <div
          class="absolute inset-y-0 right-0 rounded-r-full bg-warning/30"
          :style="{ left: `${bounds.right}%` }"
        />
        <div
          v-if="recommendedPercent !== null"
          class="absolute -inset-y-0.5 w-0.5 rounded-full bg-success"
          :style="{ left: `${recommendedPercent}%` }"
        />
      </template>
      <div
        class="absolute -inset-y-0.5 w-1 -translate-x-1/2 rounded-full bg-primary"
        :style="{ left: `${posPercent}%` }"
      />
    </div>

    <!-- 刻度标签：数值形态显示三段数值，字符串形态显示描述 -->
    <div
      class="flex justify-between text-[0.6875rem] leading-none text-muted-foreground"
      :class="!bounds && 'opacity-80'"
    >
      <template v-if="numeric">
        <span>保守 {{ numeric.c }}{{ unit ?? '' }}</span>
        <span class="font-medium text-foreground">推荐 {{ numeric.r }}{{ unit ?? '' }}</span>
        <span>激进 {{ numeric.a }}{{ unit ?? '' }}</span>
      </template>
      <template v-else-if="range">
        <span>{{ range.conservative }}</span>
        <span>{{ range.recommended }}</span>
        <span>{{ range.aggressive }}</span>
      </template>
    </div>
  </div>
</template>
