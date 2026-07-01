<script setup lang="ts">
/**
 * 一体化代码面板容器。
 *
 * 为内容区提供带边框的卡片外壳，并在顶部标题栏嵌入复制/下载/清空图标按钮。
 * 标题栏与内容区共享同一个边框容器，视觉上融为一体；按钮通过 slot 外部渲染，
 * 不会成为 textarea 等内容的子元素。
 *
 * 复制由组件内部直接处理并在按钮上反馈已复制状态；下载与清空仅触发事件，
 * 具体行为（文件名、内容类型、清空范围）由父组件决定。
 *
 * @example
 * ```vue
 * <CodePanel label="JSON 输入" showClear @clear="handleClear">
 *   <textarea v-model="input" class="w-full h-80 p-3 bg-card text-text font-mono text-sm" />
 * </CodePanel>
 *
 * <CodePanel label="输出结果" showCopy showDownload :copyText="output" @download="handleDownload">
 *   <pre class="w-full h-80 p-3 bg-card text-text font-mono text-sm">{{ output }}</pre>
 * </CodePanel>
 * ```
 */
import { useCopy } from '../../composables/useCopy';
import { Check, Copy, Download, Trash2 } from '@lucide/vue';

interface Props {
  /** 面板标签文字 */
  label?: string;
  /** 是否显示复制图标按钮 */
  showCopy?: boolean;
  /** 是否显示下载图标按钮（点击触发 download 事件，由父组件处理实际下载） */
  showDownload?: boolean;
  /** 要复制/下载的文本内容（为空时复制与下载按钮自动禁用） */
  copyText?: string;
  /** 是否显示清空图标按钮 */
  showClear?: boolean;
  /** 是否禁用按钮 */
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'download'): void;
}>();

const { copied, copy } = useCopy();

/** 处理复制 */
async function handleCopy(): Promise<void> {
  if (!props.copyText) return;
  await copy(props.copyText);
}

/** 处理下载：交由父组件决定文件名与内容类型 */
function handleDownload(): void {
  emit('download');
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
      v-if="label || showCopy || showDownload || showClear"
      class="flex items-center justify-between px-4 py-1.5 border-b border-border"
    >
      <label
        v-if="label"
        class="text-[0.8125rem] text-muted"
      >
        {{ label }}
      </label>

      <div
        v-if="showCopy || showDownload || showClear"
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
          <Check
            v-if="copied"
            :size="16"
            :stroke-width="2.5"
          />

          <!-- 复制图标 -->
          <Copy
            v-else
            :size="16"
            :stroke-width="2"
          />
        </button>

        <!-- 下载按钮 -->
        <button
          v-if="showDownload"
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-sm border border-border text-muted bg-card transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
          :class="(!copyText || disabled) && 'opacity-50 cursor-not-allowed'"
          :disabled="!copyText || disabled"
          title="下载"
          @click="handleDownload"
        >
          <Download :size="16" :stroke-width="2" />
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
          <Trash2 :size="16" :stroke-width="2" />
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
