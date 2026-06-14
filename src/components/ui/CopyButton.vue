<script setup lang="ts">
import { useCopy } from '../../composables/useCopy';

interface Props {
  /** 要复制的文本 */
  text: string;
  /** 按钮尺寸，默认 md */
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const { copied, copy } = useCopy();

const sizeClasses = {
  md: 'w-9 h-9',
  sm: 'w-7 h-7',
};

const iconSize = {
  md: 16,
  sm: 14,
};

async function handleCopy() {
  await copy(props.text);
}
</script>

<template>
  <button
    type="button"
    aria-label="复制"
    :class="[
      sizeClasses[size],
      'flex items-center justify-center',
      'rounded-sm border',
      'bg-card text-muted',
      'transition-[background-color,border-color,color] duration-150',
      'hover:bg-hover hover:text-text',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      copied ? 'border-success text-success' : 'border-border',
    ]"
    :disabled="!text"
    @click="handleCopy"
  >
    <svg
      v-if="copied"
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize[size]"
      :height="iconSize[size]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>

    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize[size]"
      :height="iconSize[size]"
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
</template>
