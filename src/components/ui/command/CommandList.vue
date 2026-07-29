<script setup lang="ts">
/**
 * Command 滚动列表容器 —— 基于 reka-ui ListboxContent。
 */
import { ListboxContent } from 'reka-ui';
import { cn } from '../../../lib/utils';
const props = defineProps<{ class?: string }>();
</script>

<template>
  <ListboxContent :class="cn('max-h-[300px] overflow-y-auto overflow-x-hidden', props.class)">
    <slot />
  </ListboxContent>
</template>
