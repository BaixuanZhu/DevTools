<script setup lang="ts">
import { ref, computed, watch, useId } from 'vue';

/**
 * 颜色输入控件：原生 <input type="color"> 与 hex 文本框双向联动。
 *
 * 设计要点：
 * - emit 的 modelValue 始终为 `#RRGGBB` 大写形式，内部自动展开 `#RGB` 简写
 * - 文本框输入非法 hex 时，实时将边框变为 `border-error`，失焦自动回滚到上次合法值
 * - 适用于需要颜色值的表单场景（二维码前景/背景色、颜色工具等）
 *
 * @example
 * <ColorInput v-model="foreground" label="前景色" />
 */
const props = defineProps<{
  /** 当前 hex 颜色（接受 #RRGGBB 或 #RGB，组件内规范化） */
  modelValue: string;
  /** 字段标签（可选，显示在左侧） */
  label?: string;
  /** 可选，用于 input id 与 label htmlFor 关联 */
  id?: string;
}>();

const emit = defineEmits<{
  /** 始终发出规范化后的 #RRGGBB 大写形式 */
  'update:modelValue': [value: string];
}>();

const autoId = useId();
const inputId = computed(() => props.id ?? `color-input-${autoId}`);

/** 文本框实时值（未规范化前） */
const textValue = ref('');

watch(
  () => props.modelValue,
  (v) => {
    textValue.value = normalize(v);
  },
  { immediate: true }
);

/** 当前文本是否符合 #RGB / #RRGGBB 格式 */
const isValid = computed(() => /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(textValue.value));

/** 供原生颜色选择器使用的规范 hex（无效时回退到 prop） */
const normalizedHex = computed(() =>
  expandShortHex(isValid.value ? textValue.value : normalize(props.modelValue || '#000000'))
);

/**
 * 规范化输入：补齐 `#` 前缀，展开 `#RGB` 简写，输出大写 `#RRGGBB`。
 * 空值或非法输入回退到 `#000000`。
 */
function normalize(v: string): string {
  if (!v) return '#000000';
  const withHash = v.startsWith('#') ? v : '#' + v;
  if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(withHash)) return '#000000';
  return expandShortHex(withHash);
}

/**
 * 将 `#RGB` 简写展开为 `#RRGGBB`，并统一为大写。
 * 非 3 位简写直接返回大写原值。
 */
function expandShortHex(v: string): string {
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const [, r, g, b] = v;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return v.toUpperCase();
}

/** 原生颜色选择器变化：直接同步并 emit 规范值 */
function onPickerChange(e: Event) {
  const value = (e.target as HTMLInputElement).value.toUpperCase();
  textValue.value = value;
  emit('update:modelValue', value);
}

/** 文本框输入：实时校验，仅在合法时 emit */
function onTextChange(e: Event) {
  let v = (e.target as HTMLInputElement).value.trim().toUpperCase();
  if (v && !v.startsWith('#')) v = '#' + v;
  textValue.value = v;
  if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(v)) {
    emit('update:modelValue', expandShortHex(v));
  }
}

/** 失焦：非法值回滚到上次的合法 modelValue */
function onTextBlur() {
  if (!isValid.value) {
    textValue.value = normalize(props.modelValue || '#000000');
  }
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <label
      v-if="label"
      :for="inputId"
      class="text-[0.8125rem] text-muted min-w-[72px] shrink-0"
    >
      {{ label }}
    </label>
    <div class="flex items-center gap-1">
      <input
        type="color"
        :value="normalizedHex"
        @input="onPickerChange"
        class="w-7 h-7 p-0 border border-border rounded-sm cursor-pointer bg-transparent hover:border-accent focus:border-accent focus:outline-none transition-colors"
        aria-label="颜色选择器"
      />
      <input
        :id="inputId"
        type="text"
        :value="textValue"
        @input="onTextChange"
        @blur="onTextBlur"
        class="px-2 py-1 border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent hover:border-accent w-[88px] transition-colors"
        :class="isValid ? 'border-border' : 'border-error'"
        placeholder="#000000"
        maxlength="7"
        spellcheck="false"
      />
    </div>
  </div>
</template>
