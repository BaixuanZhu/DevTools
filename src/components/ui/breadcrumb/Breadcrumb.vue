<script setup lang="ts">
/** shadcn-vue Breadcrumb 容器（无样式，仅语义 wrapper）*/
defineProps<{ class?: string }>();
</script>

<template>
  <nav aria-label="breadcrumb" :class="$props.class">
    <slot />
  </nav>
</template>
