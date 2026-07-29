<script setup lang="ts">
import { DropdownMenuTrigger } from 'reka-ui';
const props = defineProps<{ asChild?: boolean; class?: string }>();
</script>

<template>
  <DropdownMenuTrigger :as-child="props.asChild" :class="props.class">
    <slot />
  </DropdownMenuTrigger>
</template>
