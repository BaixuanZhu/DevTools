<script setup lang="ts">
import { DialogTrigger } from 'reka-ui';
const props = defineProps<{ asChild?: boolean; class?: string }>();
</script>

<template>
  <DialogTrigger :as-child="props.asChild" :class="props.class">
    <slot />
  </DialogTrigger>
</template>
