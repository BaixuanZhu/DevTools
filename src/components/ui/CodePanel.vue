<script setup lang="ts">
/**
 * 一体化代码面板容器。
 *
 * 为内容区提供带边框的卡片外壳，并在顶部标题栏嵌入复制/清空图标按钮。
 * 标题栏与内容区共享同一个边框容器，视觉上融为一体；按钮通过 slot 外部渲染，
 * 不会成为 textarea 等内容的子元素。
 *
 * @example
 * ```vue
 * <CodePanel label="JSON 输入" showClear @clear="handleClear">
 *   <textarea v-model="input" class="w-full h-80 p-3 bg-card text-text font-mono text-sm" />
 * </CodePanel>
 *
 * <CodePanel label="输出结果" showCopy :copyText="output">
 *   <pre class="w-full h-80 p-3 bg-card text-text font-mono text-sm">{{ output }}</pre>
 * </CodePanel>
 * ```
 */
import { ref } from 'vue';
import { copyToClipboard } from '../../utils/shared/clipboard';

interface Props {
  /** 面板标签文字 */
  label?: string;
  /** 是否显示复制图标按钮 */
  showCopy?: boolean;
  /** 要复制的文本内容 */
  copyText?: string;
  /** 是否显示清空图标按钮 */
  showClear?: boolean;
  /** 是否禁用按钮 */
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'clear'): void;
}>();

/** 复制成功状态 */
const copied = ref(false);

/** 处理复制 */
async function handleCopy(): Promise<void> {
  if (!props.copyText) return;

  const success = await copyToClipboard(props.copyText);
  if (success) {
    copied.value = true;
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: '已复制' } }));
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  }
}

/** 处理清空 */
function handleClear(): void {
  emit('clear');
}
</script>

<template>
  <div class="border border-border rounded-sm overflow-hidden bg-card">
    <!-- 标题栏：label + 操作按钮 -->
    <div
      v-if="label || showCopy || showClear"
      class="flex items-center justify-between px-4 py-1.5 border-b border-border"
    >
      <label
        v-if="label"
        class="text-[0.8125rem] text-muted"
      >
        {{ label }}
      </label>

      <div
        v-if="showCopy || showClear"
        class="flex gap-1"
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
    </div>

    <!-- 内容区 -->
    <slot />
  </div>
</template>

<style scoped>
/* 让 slot 中的内容去掉自带边框/圆角，与外层卡片容器融为一体 */
:slotted(textarea),
:slotted(pre),
:slotted(div) {
  border: none;
  border-radius: 0;
}
</style>
