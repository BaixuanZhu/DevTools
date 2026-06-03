<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  showExample?: boolean;
}>();

const emit = defineEmits<{
  (e: 'example'): void;
}>();
</script>

<template>
  <div class="flex items-start justify-between gap-4 mb-6">
    <div>
      <h1 class="text-xl font-semibold m-0">{{ title }}</h1>
      <p class="mt-1 text-sm text-muted m-0">{{ description }}</p>
    </div>
    <button
      v-if="showExample !== false"
      class="shrink-0 px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
      @click="$emit('example')"
    >
      填入示例
    </button>
  </div>
</template>
