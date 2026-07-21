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
    class="px-4 py-2 border border-border rounded-sm bg-card text-muted-foreground text-[0.8125rem] font-sans cursor-pointer transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
    @click="$emit('clear')"
  >
    {{ label || '清空' }}
  </button>
</template>
