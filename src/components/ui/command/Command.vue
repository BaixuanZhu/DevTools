<script setup lang="ts">
/**
 * shadcn-vue Command 容器 —— 基于 reka-ui ListboxRoot。
 *
 * shadcn-vue 的 Command 不用 cmdk（那是 React shadcn/ui 的底层），
 * Vue 版基于 reka-ui Listbox 原语（见 https://reka-ui.com/docs/components/listbox）。
 * 过滤逻辑由消费方自行 computed（ListboxFilter 只负责输入，不过滤）。
 */
import { ListboxRoot } from 'reka-ui';
import { cn } from '../../../lib/utils';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <ListboxRoot :class="cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', props.class)">
    <slot />
  </ListboxRoot>
</template>
