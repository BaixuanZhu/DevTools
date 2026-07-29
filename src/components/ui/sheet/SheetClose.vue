<script setup lang="ts">
import { DialogClose } from 'reka-ui';
const props = defineProps<{ asChild?: boolean; class?: string }>();
</script>

<template>
  <DialogClose :as-child="props.asChild" :class="props.class">
    <slot />
  </DialogClose>
</template>
