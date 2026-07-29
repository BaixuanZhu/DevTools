<script setup lang="ts">
import { ChevronRight } from '@lucide/vue';
import { cn } from '../../../lib/utils';
const props = defineProps<{ class?: string }>();
</script>

<template>
  <li :class="cn('[&>svg]:size-3.5', props.class)" role="presentation" aria-hidden="true">
    <ChevronRight />
  </li>
</template>
