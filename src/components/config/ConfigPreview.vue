<script setup lang="ts">
/**
 * 右栏配置预览（配置生成器系列共享）：行号 + 注释/指令视觉区分 + 变动行短暂高亮，
 * 底部操作条（复制 / 下载 / 重置为推荐值）复用 CodePanel。
 * 预览与下载共用同一份 ConfLine[]，保证"所见即所得"。
 * 序列化格式各工具不同（redis `key value`，mysql/PG `key = value`），serializeConf
 * 留在各工具 generate.ts，本组件经 copyText prop 接收成品文本，不感知具体格式。
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import CodePanel from '../ui/CodePanel.vue';
import type { ConfLine } from './types';

const props = defineProps<{
  /** 生成的 conf 行数组 */
  lines: ConfLine[];
  /** 面板标签（产物文件名，如 'redis.conf' / 'my.cnf' / 'postgresql.conf'） */
  label: string;
  /** 复制/下载用的完整文本（由父层 serializeConf(lines) 计算） */
  copyText: string;
}>();

const emit = defineEmits<{
  /** 下载 conf 文件（文件名与序列化由父层处理） */
  download: [];
  /** 重置为推荐值 */
  reset: [];
}>();

/** 变动高亮中的参数 key 集合（200ms 后自动清除） */
const flashing = ref<Set<string>>(new Set());

/** 上一帧各参数指令文本（用于 diff 出本次变动的行） */
let prevTexts = new Map<string, string>();

/** 高亮清除定时器 */
let flashTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.lines,
  (newLines) => {
    const newMap = new Map<string, string>();
    for (const line of newLines) {
      if (line.paramKey) newMap.set(line.paramKey, line.text);
    }
    const changed = new Set<string>();
    for (const [key, text] of newMap) {
      if (prevTexts.get(key) !== text) changed.add(key);
    }
    for (const key of prevTexts.keys()) {
      if (!newMap.has(key)) changed.add(key);
    }
    prevTexts = newMap;
    if (changed.size > 0) {
      flashing.value = changed;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashing.value = new Set();
      }, 200);
    }
  },
);

onBeforeUnmount(() => {
  if (flashTimer) clearTimeout(flashTimer);
});

/** 行样式：注释灰显、变动行短暂高亮 */
function lineClass(line: ConfLine): string {
  if (line.type === 'comment') return 'text-muted-foreground';
  if (line.paramKey && flashing.value.has(line.paramKey)) return 'text-foreground bg-warning/20';
  return 'text-foreground';
}
</script>

<template>
  <CodePanel
    :label="label"
    show-copy
    show-download
    show-clear
    :copy-text="copyText"
    @download="emit('download')"
    @clear="emit('reset')"
  >
    <div class="max-h-105 overflow-auto lg:max-h-[calc(100dvh-320px)]">
      <div class="min-w-max px-2 py-3 font-mono text-xs leading-6">
        <div
          v-for="(line, index) in lines"
          :key="index"
          class="flex rounded-sm px-1 transition-[background-color] duration-150"
          :class="line.paramKey && flashing.has(line.paramKey) && 'bg-warning/20'"
        >
          <span class="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50 tabular-nums">
            {{ index + 1 }}
          </span>
          <span class="whitespace-pre" :class="lineClass(line)">{{ line.text || ' ' }}</span>
        </div>
      </div>
    </div>
  </CodePanel>
</template>
