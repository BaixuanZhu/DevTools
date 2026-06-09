<script setup lang="ts">
/**
 * 带内嵌操作按钮的代码面板容器。
 *
 * 在内容区右上角提供复制/清空图标按钮，减少页面层级并提升操作直觉。
 * 通过 slot 接收 textarea、pre、div 等任意内容元素。
 *
 * @example
 * ```vue
 * <CodePanel label="JSON 输入" showClear @clear="handleClear">
 *   <textarea v-model="input" class="..." />
 * </CodePanel>
 *
 * <CodePanel label="输出结果" showCopy :copyText="output">
 *   <pre>{{ output }}</pre>
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
  <div>
    <label
      v-if="label"
      class="block text-[0.8125rem] text-muted mb-1.5"
    >
      {{ label }}
    </label>

    <div class="relative">
      <slot />

      <!-- 右上角操作按钮组 -->
      <div
        v-if="showCopy || showClear"
        class="absolute top-2 right-2 flex gap-1"
      >
        <!-- 复制按钮 -->
        <button
          v-if="showCopy"
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-sm border transition-[background-color,border-color,color] duration-150"
          :class="[
            copied
              ? 'border-success text-success bg-card/90'
              : 'border-border text-muted bg-card/90 hover:bg-hover hover:text-text',
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
          class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card/90 transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
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
  </div>
</template>
