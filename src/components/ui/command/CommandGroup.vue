<script setup lang="ts">
/**
 * Command 分组 —— 基于 reka-ui ListboxGroup + ListboxGroupLabel。
 */
import { ListboxGroup, ListboxGroupLabel } from 'reka-ui';
import { cn } from '../../../lib/utils';

const props = defineProps<{ class?: string; heading?: string }>();
</script>

<template>
  <ListboxGroup :class="cn('overflow-hidden p-1 text-foreground', props.class)">
    <ListboxGroupLabel v-if="heading" class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
      {{ heading }}
    </ListboxGroupLabel>
    <slot />
  </ListboxGroup>
</template>
