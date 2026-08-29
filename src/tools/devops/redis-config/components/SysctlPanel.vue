<script setup lang="ts">
/**
 * 系统参数建议面板（本工具私有，可折叠）：
 * 输出 vm.overcommit_memory、THP、somaxconn、nofile 等内核/ulimit 建议——
 * 这些不属于 redis.conf，与 conf 中的 tcp-backlog / maxclients 联动计算。
 */
import { ref } from 'vue';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import type { SysctlSuggestion } from '../sysctl';
import CopyButton from '../../../../components/ui/CopyButton.vue';

defineProps<{
  /** 建议条目（父层按当前 conf 值联动生成） */
  items: SysctlSuggestion[];
}>();

/** 折叠态（默认收起，避免喧宾夺主） */
const open = ref(false);
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="rounded-lg border border-border bg-card">
    <CollapsibleTrigger
      class="flex w-full items-center justify-between px-4 py-2.5 text-left text-[0.8125rem] font-medium text-foreground transition-[background-color] duration-150 hover:bg-accent"
    >
      <span>系统参数建议（内核与 ulimit，非 redis.conf）</span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150"
        :class="open && 'rotate-180'"
        :size="16"
        aria-hidden="true"
      />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div class="flex flex-col gap-4 border-t border-border px-4 py-4">
        <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">
          以下设置在宿主机（或容器宿主）层面生效，与上方 conf 配合才能达到预期容量与稳定性。
        </p>
        <div v-for="item in items" :key="item.title" class="flex flex-col gap-1">
          <p class="text-[0.8125rem] font-medium text-foreground">{{ item.title }}</p>
          <div class="flex items-start gap-2">
            <pre class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-accent px-3 py-2 font-mono text-xs text-foreground">{{ item.command }}</pre>
            <CopyButton :text="item.command" size="sm" />
          </div>
          <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">{{ item.reason }}</p>
        </div>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
