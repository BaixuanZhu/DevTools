<script setup lang="ts">
import { DropdownMenuLabel } from 'reka-ui';
import { cn } from '../../../lib/utils';
const props = defineProps<{ class?: string; inset?: boolean }>();
</script>

<template>
  <DropdownMenuLabel :data-inset="inset ? '' : undefined" :class="cn('px-2 py-1.5 text-sm font-semibold data-[inset]:pl-8', props.class)">
    <slot />
  </DropdownMenuLabel>
</template>
