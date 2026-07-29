<script setup lang="ts">
import { cn } from '../../../lib/utils';
const props = defineProps<{ class?: string }>();
</script>

<template>
  <a :class="cn('transition-colors hover:text-foreground', props.class)">
    <slot />
  </a>
</template>
