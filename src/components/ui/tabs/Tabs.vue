<script setup lang="ts">
import { TabsRoot, type TabsRootProps } from 'reka-ui';
import { cn } from '../../../lib/utils';

const props = withDefaults(defineProps<{
  modelValue?: string;
  defaultValue?: string;
  orientation?: TabsRootProps['orientation'];
  class?: string;
}>(), { orientation: 'horizontal' });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <TabsRoot
    :model-value="props.modelValue"
    :default-value="props.defaultValue"
    :orientation="props.orientation"
    @update:model-value="emit('update:modelValue', $event)"
    :class="cn('flex flex-col gap-2', props.class)"
  >
    <slot />
  </TabsRoot>
</template>
