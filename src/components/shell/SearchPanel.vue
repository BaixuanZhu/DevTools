<script setup lang="ts">
/**
 * 首页搜索面板（client:load 岛）—— 基于 shadcn-vue Command（reka-ui Listbox）。
 *
 * 行为：输入实时匹配 tools（name/keywords/description）→ 自行 computed 过滤
 * → 键盘导航（↑↓ Enter）→ 选中直达 tool.path（MPA 全页跳转）。
 *
 * 注：reka-ui Listbox 不提供内置 filterFunction，过滤逻辑由本组件 computed 完成。
 */
import { ref, computed } from 'vue';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '../ui/command';
import { tools, type ToolMeta } from '../../data/tools';

const query = ref('');

/** 过滤逻辑：匹配 name / keywords / description，按相关度排序 */
const filteredTools = computed<ToolMeta[]>(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return tools;

  return tools
    .map((tool) => {
      let score = 0;
      if (tool.name.toLowerCase().includes(needle)) score += 10;
      if (tool.keywords.some((k) => k.toLowerCase().includes(needle))) score += 5;
      if (tool.description.toLowerCase().includes(needle)) score += 1;
      return { tool, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.tool);
});

function go(tool: ToolMeta): void {
  window.location.href = tool.path;
}

function onSelect(value: string): void {
  const tool = tools.find((t) => t.id === value || t.name === value);
  if (tool) go(tool);
}
</script>

<template>
  <div class="mx-auto mb-8 max-w-190">
    <Command class="rounded-lg border shadow-sm">
      <CommandInput v-model="query" placeholder="搜索工具，如 base64 / jwt / 二维码..." aria-label="搜索工具" />
      <CommandList>
        <CommandEmpty v-if="filteredTools.length === 0">没有匹配的工具</CommandEmpty>
        <CommandGroup v-else heading="全部工具">
          <CommandItem
            v-for="tool in filteredTools"
            :key="tool.id"
            :value="tool.id"
            @select="onSelect(tool.id)"
          >
            <span class="w-6 shrink-0 text-center text-lg">{{ tool.icon }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ tool.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ tool.description }}</span>
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
</template>
