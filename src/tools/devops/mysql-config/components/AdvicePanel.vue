<script setup lang="ts">
/**
 * 附加建议面板（本工具私有，可折叠）：OS 层设置（ulimit / vm.swappiness /
 * IO 调度 / 文件系统）不属于 my.cnf，在产物之外单独输出；主从模式追加
 * "复制初始化 SQL 提示"区块（占位符形式，等宽字体展示，可一键复制）。
 * 形态对齐 Redis 版的 SysctlPanel。
 */
import { ref } from 'vue';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import type { OsAdvice, ReplicationSetupHint } from '../advice';
import CopyButton from '../../../../components/ui/CopyButton.vue';

defineProps<{
  /** OS 层建议条目（父层按当前 conf 值联动生成） */
  items: OsAdvice[];
  /** 复制初始化 SQL 提示（仅主从模式传入，单机为 null 不渲染） */
  replicationHint?: ReplicationSetupHint | null;
}>();

/** 折叠态（默认收起，避免喧宾夺主） */
const open = ref(false);
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="rounded-lg border border-border bg-card">
    <CollapsibleTrigger
      class="flex w-full items-center justify-between px-4 py-2.5 text-left text-[0.8125rem] font-medium text-foreground transition-[background-color] duration-150 hover:bg-accent"
    >
      <span>OS 层建议（ulimit 与内核参数，非 my.cnf）</span>
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
          以下设置在宿主机（或容器宿主）层面生效，与上方 my.cnf 配合才能达到预期容量与稳定性。
        </p>
        <div v-for="item in items" :key="item.title" class="flex flex-col gap-1">
          <p class="text-[0.8125rem] font-medium text-foreground">{{ item.title }}</p>
          <div class="flex items-start gap-2">
            <pre class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-accent px-3 py-2 font-mono text-xs text-foreground">{{ item.command }}</pre>
            <CopyButton :text="item.command" size="sm" />
          </div>
          <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">{{ item.reason }}</p>
        </div>

        <!-- 主从模式追加：复制初始化 SQL 提示（占位符，改后可在副本直接执行） -->
        <div v-if="replicationHint" class="flex flex-col gap-1 rounded-md border border-border p-3">
          <p class="text-[0.8125rem] font-medium text-foreground">{{ replicationHint.title }}</p>
          <div class="flex items-start gap-2">
            <pre class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-accent px-3 py-2 font-mono text-xs text-foreground">{{ replicationHint.sql }}</pre>
            <CopyButton :text="replicationHint.sql" size="sm" />
          </div>
          <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">{{ replicationHint.note }}</p>
        </div>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
