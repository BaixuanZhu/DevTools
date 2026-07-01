<script setup lang="ts">
import {useCopy} from '../../composables/useCopy';
import { Check, Copy } from '@lucide/vue';

interface Props {
  /** 要复制的文本 */
  text: string;
  /** 按钮尺寸，默认 md */
  size: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
});

const {copied, copy} = useCopy();

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
      :title="copied ? '已复制' : '复制'"
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
    <Check
        v-if="copied"
        :size="iconSize[size]"
        :stroke-width="2.5"
    />

    <Copy
        v-else
        :size="iconSize[size]"
        :stroke-width="2"
    />
  </button>
</template>
