<script setup lang="ts">
/**
 * CSS 单位转换器交互组件。
 *
 * 支持 px / rem / em / vw / vh / % / pt 七种单位实时互转。
 * 修改任意输入框时，该单位成为计算源，其余单位实时联动更新。
 */
import { ref, reactive, computed, watch, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import { useCopy } from '../../composables/useCopy';
import {
  UNIT_ORDER,
  UNIT_LABELS,
  convertAll,
  formatNumber,
  isValidNumberInput,
  buildCopyText,
  type UnitKey,
} from '../../utils/css/unit-converter';

// ---- 常量 ----

/** 默认值：16px */
const DEFAULT_SOURCE_UNIT: UnitKey = 'px';

// ---- 状态 ----

const rootFontSize = ref(16);
const designWidth = ref(375);
const viewportHeight = ref(812);
const lastEditedUnit = ref<UnitKey>(DEFAULT_SOURCE_UNIT);
const values = reactive<Record<UnitKey, string>>({
  px: '16',
  rem: '1',
  em: '1',
  vw: '4.2667',
  vh: '1.9704',
  pct: '100',
  pt: '12',
});
const errors = reactive<Partial<Record<UnitKey, string>>>({});
const baseErrors = reactive({
  rootFontSize: '',
  designWidth: '',
  viewportHeight: '',
});

const { copy } = useCopy();

// ---- 派生 ----

const context = computed(() => ({
  rootFontSize: rootFontSize.value,
  designWidth: designWidth.value,
  viewportHeight: viewportHeight.value,
}));

const copyText = computed(() => buildCopyText(values, lastEditedUnit.value));

// ---- 核心逻辑 ----

function recalculateAll(): void {
  const sourceValueStr = values[lastEditedUnit.value];
  if (!isValidNumberInput(sourceValueStr)) {
    errors[lastEditedUnit.value] = '请输入有效数字';
    for (const unit of UNIT_ORDER) {
      if (unit !== lastEditedUnit.value) {
        values[unit] = '—';
      }
    }
    return;
  }

  errors[lastEditedUnit.value] = '';
  const sourceValue = Number(sourceValueStr);
  const result = convertAll(sourceValue, lastEditedUnit.value, context.value);
  for (const unit of UNIT_ORDER) {
    if (unit === lastEditedUnit.value) continue;
    values[unit] = formatNumber(result[unit]);
  }
}

function handleInput(unit: UnitKey, event: Event): void {
  const target = event.target as HTMLInputElement;
  values[unit] = target.value;
  lastEditedUnit.value = unit;
  recalculateAll();
}

function validateBase(): boolean {
  let ok = true;
  baseErrors.rootFontSize =
    rootFontSize.value > 0 ? '' : '根字号必须大于 0';
  baseErrors.designWidth =
    designWidth.value > 0 ? '' : '设计稿宽度必须大于 0';
  baseErrors.viewportHeight =
    viewportHeight.value > 0 ? '' : '视口高度必须大于 0';
  ok = !baseErrors.rootFontSize && !baseErrors.designWidth && !baseErrors.viewportHeight;
  return ok;
}

function handleBaseInput(): void {
  if (!validateBase()) {
    for (const unit of UNIT_ORDER) {
      values[unit] = '—';
    }
    return;
  }
  recalculateAll();
}

function handleClear(): void {
  lastEditedUnit.value = DEFAULT_SOURCE_UNIT;
  values.px = '';
  values.rem = '';
  values.em = '';
  values.vw = '';
  values.vh = '';
  values.pct = '';
  values.pt = '';
  for (const unit of UNIT_ORDER) {
    errors[unit] = '';
  }
}

async function handleCopyAll(): Promise<void> {
  await copy(copyText.value);
}

// ---- 初始化 ----

watch(context, handleBaseInput, { deep: true });

onMounted(() => {
  recalculateAll();
});
</script>

<template>
  <div>
    <ToolHeader
      title="CSS 单位转换器"
      description="px / rem / em / vw / vh / % / pt 实时互转，支持自定义根字号、设计稿宽度与视口高度。"
      :show-example="false"
    />

    <!-- 基准设置 -->
    <section class="mb-6 p-4 border border-border rounded-sm bg-card">
      <h2 class="text-sm font-semibold text-text mb-4">基准设置</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-xs text-muted mb-1.5">根字号（px）</label>
          <input
            v-model.number="rootFontSize"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            @input="handleBaseInput"
          />
          <p v-if="baseErrors.rootFontSize" class="mt-1.5 text-xs text-error">{{ baseErrors.rootFontSize }}</p>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1.5">设计稿宽度（px）</label>
          <input
            v-model.number="designWidth"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            @input="handleBaseInput"
          />
          <p v-if="baseErrors.designWidth" class="mt-1.5 text-xs text-error">{{ baseErrors.designWidth }}</p>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1.5">视口高度（px）</label>
          <input
            v-model.number="viewportHeight"
            type="number"
            min="1"
            class="w-full px-3 py-2 border border-border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            @input="handleBaseInput"
          />
          <p v-if="baseErrors.viewportHeight" class="mt-1.5 text-xs text-error">{{ baseErrors.viewportHeight }}</p>
        </div>
      </div>
    </section>

    <!-- 转换输入 -->
    <section class="mb-6">
      <h2 class="text-sm font-semibold text-text mb-4">转换输入（修改任意一项，其余联动）</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="unit in UNIT_ORDER"
          :key="unit"
          class="p-3 border rounded-sm transition-colors duration-150"
          :class="lastEditedUnit === unit ? 'border-accent bg-accent/5' : 'border-border bg-card'"
        >
          <label class="block text-xs text-muted mb-1.5">{{ UNIT_LABELS[unit] }}</label>
          <input
            :value="values[unit]"
            type="text"
            inputmode="decimal"
            class="w-full px-3 py-2 border rounded-sm bg-background text-text text-sm focus:outline-none focus:border-accent"
            :class="errors[unit] ? 'border-error' : 'border-border'"
            @input="handleInput(unit, $event)"
          />
          <p v-if="errors[unit]" class="mt-1.5 text-xs text-error">{{ errors[unit] }}</p>
        </div>
      </div>
    </section>

    <!-- 操作栏 -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
        @click="handleClear"
      >
        清空
      </button>
      <button
        type="button"
        class="px-4 py-2 border border-border rounded-sm bg-card text-text text-sm hover:bg-hover transition-colors duration-150"
        :disabled="!copyText"
        @click="handleCopyAll"
      >
        复制全部结果
      </button>
    </div>
  </div>
</template>
