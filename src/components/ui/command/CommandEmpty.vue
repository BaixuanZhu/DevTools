<script setup lang="ts">
/**
 * Command 空状态 —— reka-ui Listbox 无内置 Empty 原语，
 * 此处为纯样式 div，由消费方通过 v-if 控制显隐。
 */
const props = defineProps<{ class?: string }>();
</script>

<template>
  <div :class="props.class" class="py-6 text-center text-sm">
    <slot>无匹配结果</slot>
  </div>
</template>
