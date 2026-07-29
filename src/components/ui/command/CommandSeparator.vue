<script setup lang="ts">
/**
 * Command 分隔线 —— reka-ui Listbox 无内置 Separator，
 * 此处为纯样式 div。
 */
import { cn } from '../../../lib/utils';
const props = defineProps<{ class?: string }>();
</script>

<template>
  <div :class="cn('-mx-1 h-px bg-border', props.class)" />
</template>
