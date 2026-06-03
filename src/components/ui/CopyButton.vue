<script setup lang="ts">
import { ref } from 'vue';
import { copyToClipboard } from '../../utils/shared/clipboard';

const props = defineProps<{
  text: string;
  label?: string;
}>();

const copied = ref(false);

async function handleCopy() {
  const success = await copyToClipboard(props.text);
  if (success) {
    copied.value = true;
    // 触发 Alpine toast
    document.dispatchEvent(new CustomEvent('toast:success', { detail: { message: '已复制' } }));
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  }
}
</script>

<template>
  <button
    :class="[
      'px-4 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color,color] duration-150',
      copied
        ? 'border-success text-success bg-card'
        : 'border-border text-text bg-card hover:bg-hover',
      !text && 'opacity-50 cursor-not-allowed',
    ]"
    @click="handleCopy"
    :disabled="!text"
  >
    {{ copied ? '✓ 已复制' : (label || '复制') }}
  </button>
</template>
