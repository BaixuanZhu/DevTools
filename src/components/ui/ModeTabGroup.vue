<script setup lang="ts">
import { computed } from 'vue';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue';

const props = defineProps<{
  modelValue: string;
  options: { key: string; label: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selectedIndex = computed(() => {
  const index = props.options.findIndex((opt) => opt.key === props.modelValue);
  return index >= 0 ? index : 0;
});

function handleChange(index: number) {
  const option = props.options[index];
  if (option) {
    emit('update:modelValue', option.key);
  }
}
</script>

<template>
  <TabGroup :selected-index="selectedIndex" @change="handleChange">
    <TabList class="flex gap-1 mb-4">
      <Tab
        v-for="option in options"
        :key="option.key"
        :class="[
          'px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer',
          'transition-[background-color,border-color] duration-150',
          'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          'ui-selected:bg-accent ui-selected:text-white ui-selected:border-accent',
          'ui-not-selected:bg-card ui-not-selected:text-text ui-not-selected:border-border ui-not-selected:hover:bg-hover',
        ]"
      >
        {{ option.label }}
      </Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="option in options" :key="option.key">
        <slot :name="option.key" />
      </TabPanel>
    </TabPanels>
  </TabGroup>
</template>
