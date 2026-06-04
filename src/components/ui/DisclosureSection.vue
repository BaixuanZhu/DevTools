<script setup>
import {Disclosure, DisclosureButton, DisclosurePanel} from '@headlessui/vue'

defineProps({
  title: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="border-t border-border pt-4">
    <Disclosure v-slot="{ open }">
      <DisclosureButton
          class="flex w-full items-center justify-between cursor-pointer text-[0.8125rem] text-muted hover:text-text transition-[color] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
      >
        <span>{{ title }}</span>
        <svg
            class="h-4 w-4 transition-transform duration-150 ui-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
        >
          <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          />
        </svg>
      </DisclosureButton>
      <DisclosurePanel class="pt-2">
        <slot/>
      </DisclosurePanel>
    </Disclosure>
  </div>
</template>
