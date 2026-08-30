<script setup lang="ts">
/**
 * 附加建议面板（本工具私有）：OS 层内核参数（sysctl / 大页 / 文件描述符）
 * 不属于 postgresql.conf，在产物之外单独输出，按来源分"官方文档背书"与
 * "社区惯例"两分区渲染（社区区明确标注官方文档未覆盖）；主从模式追加
 * "备库要点"折叠面板（主库侧 SQL + pg_basebackup 命令 + 备库参数下限要点）。
 * 底部附免责声明行（参考值 + 本地计算不上传）。形态对齐 MySQL 版 AdvicePanel。
 */
import { ref } from 'vue';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import type { OsAdviceSection, ReplicationSetupHint } from '../advice';
import CopyButton from '../../../../components/ui/CopyButton.vue';

defineProps<{
  /** OS 层建议分区（官方背书 / 社区惯例两区，父层按当前画像联动生成） */
  sections: OsAdviceSection[];
  /** 备库要点提示（仅主从模式传入，单机为 null 不渲染整个面板） */
  replicationHint?: ReplicationSetupHint | null;
}>();

/** OS 建议折叠态（默认收起，避免喧宾夺主） */
const osOpen = ref(false);

/** 备库要点折叠态（默认收起） */
const replicationOpen = ref(false);
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- OS 层建议：内核参数与文件描述符，两分区按来源标注可信度 -->
    <CollapsibleRoot v-model:open="osOpen" class="rounded-lg border border-border bg-card">
      <CollapsibleTrigger
        class="flex w-full items-center justify-between px-4 py-2.5 text-left text-[0.8125rem] font-medium text-foreground transition-[background-color] duration-150 hover:bg-accent"
      >
        <span>OS 层建议（内核参数，非 postgresql.conf）</span>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150"
          :class="osOpen && 'rotate-180'"
          :size="16"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="flex flex-col gap-4 border-t border-border px-4 py-4">
          <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">
            以下设置在宿主机（或容器宿主）层面生效，与上方 postgresql.conf 配合才能达到预期容量与稳定性。
          </p>
          <div v-for="section in sections" :key="section.source" class="flex flex-col gap-3">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p class="text-[0.8125rem] font-medium text-foreground">{{ section.label }}</p>
              <p class="text-[0.6875rem] leading-relaxed text-muted-foreground">{{ section.note }}</p>
            </div>
            <div v-for="item in section.items" :key="item.title" class="flex flex-col gap-1">
              <p class="text-[0.8125rem] font-medium text-foreground">{{ item.title }}</p>
              <div class="flex items-start gap-2">
                <pre class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-accent px-3 py-2 font-mono text-xs text-foreground">{{ item.command }}</pre>
                <CopyButton :text="item.command" size="sm" />
              </div>
              <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">{{ item.reason }}</p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>

    <!-- 备库要点：仅主从模式出现（占位符命令块，改后可在备库直接执行） -->
    <CollapsibleRoot v-if="replicationHint" v-model:open="replicationOpen" class="rounded-lg border border-border bg-card">
      <CollapsibleTrigger
        class="flex w-full items-center justify-between px-4 py-2.5 text-left text-[0.8125rem] font-medium text-foreground transition-[background-color] duration-150 hover:bg-accent"
      >
        <span>备库要点（从主库到 standby）</span>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150"
          :class="replicationOpen && 'rotate-180'"
          :size="16"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="flex flex-col gap-2 border-t border-border px-4 py-4">
          <p class="text-[0.8125rem] font-medium text-foreground">{{ replicationHint.title }}</p>
          <div class="flex items-start gap-2">
            <pre class="min-w-0 flex-1 overflow-x-auto rounded-sm bg-accent px-3 py-2 font-mono text-xs text-foreground">{{ replicationHint.commands }}</pre>
            <CopyButton :text="replicationHint.commands" size="sm" />
          </div>
          <ul class="flex flex-col gap-1.5 pt-1">
            <li
              v-for="point in replicationHint.points"
              :key="point"
              class="flex items-start gap-2 text-[0.8125rem] leading-relaxed text-muted-foreground"
            >
              <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true"></span>
              <span>{{ point }}</span>
            </li>
          </ul>
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>

    <!-- 免责声明（文案对齐系列：参考值 + 本地计算不上传） -->
    <p class="text-[0.8125rem] leading-relaxed text-muted-foreground">
      免责声明：输出为参考值，需结合
      <code class="rounded-sm bg-accent px-1 font-mono text-xs">pg_stat_statements</code> /
      日志 / 监控数据持续调整；所有计算均在浏览器本地完成，数据不上传。
    </p>
  </div>
</template>
