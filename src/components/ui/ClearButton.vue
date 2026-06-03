<script setup lang="ts">
defineProps<{
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
}>();
</script>

<template>
  <button
    class="px-4 py-2 border border-border rounded-sm bg-card text-muted text-[0.8125rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-hover hover:text-text"
    @click="$emit('clear')"
  >
    {{ label || '清空' }}
  </button>
</template>
