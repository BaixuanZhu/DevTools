<script setup lang="ts">
/**
 * 全局应用壳层（ToolLayout 唯一 client:load 岛）—— shadcn-vue 重构版。
 *
 * 用到的 shadcn-vue 组件：
 * - Button（Header 按钮 + Sidebar 分类项的触发）
 * - Sheet（移动端导航抽屉，替代手写 sidebar-open 状态）
 * - DropdownMenu（主题切换菜单，替代单按钮 toggle）
 * - Toaster（Sonner，全局 Toast 容器，替代 ToastContainer.vue）
 *
 * 桌面端侧边栏保持静态常驻（原项目布局不变），仅移动端走 Sheet。
 * Header 中部（≥lg 断点）渲染快捷入口 nav，清单由 layouts 经 quickLinks prop 传入
 * （数据源 src/data/quick-links.ts，Shell 不直接 import 工具注册表）。
 */
import { onMounted } from 'vue';
import { Wrench, Sun, Moon, Menu, Check, Monitor, ExternalLink } from '@lucide/vue';
import { siGithub, siGitee } from 'simple-icons';
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem,
} from 'reka-ui';
import type { ToolMeta } from '../../data/tools';
import type { CategoryMeta } from '../../data/categories';
import type { QuickLinkTool } from '../../data/quick-links';
import { sidebarStore } from '../../stores/sidebar';
import { themeStore } from '../../stores/theme';
import { Button, buttonVariants } from '../ui/button';
import { Badge } from '../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Toaster } from '../ui/sonner';

interface Props {
  /** 分类元数据列表（Sidebar 桌面常驻 + 移动 Sheet 共用） */
  categories: CategoryMeta[];
  /** 分类名 → 工具元数据子集映射（Sidebar 工具数徽标用） */
  toolsByCategory: Record<string, Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon'>[]>;
  /** 当前页面路径（激活态匹配依据） */
  currentPath: string;
  /** Header 中部快捷入口清单（≥lg 渲染）；缺省为 [] 时不渲染，向后兼容 */
  quickLinks?: QuickLinkTool[];
  /** 独立工作台工具清单（Sidebar 顶部一级菜单区；链接一律新标签页打开） */
  standaloneTools?: Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon'>[];
}
const props = withDefaults(defineProps<Props>(), { quickLinks: () => [], standaloneTools: () => [] });

const { isOpen } = sidebarStore;
const { mode, current } = themeStore;

onMounted(() => themeStore.load());

/** 分类高亮判断（当前路径前缀匹配）*/
function isCategoryActive(slug: string): boolean {
  return props.currentPath === `/${slug}` || props.currentPath.startsWith(`/${slug}/`);
}

/** 侧栏分类列表（桌面常驻 + 移动 Sheet 共用渲染）*/
function renderCategory(cat: CategoryMeta): { href: string; active: boolean; count: number } {
  return {
    href: `/${cat.slug}`,
    active: isCategoryActive(cat.slug),
    count: (props.toolsByCategory[cat.name] || []).length,
  };
}
</script>

<template>
  <div id="app" class="h-dvh flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-2 border-b border-border bg-card h-[57px] shrink-0">
      <div class="flex items-center gap-4">
        <!-- 移动端：汉堡按钮触发 Sheet -->
        <Button
          variant="ghost"
          size="icon"
          class="hidden max-lg:flex"
          aria-label="打开导航菜单"
          :aria-expanded="isOpen"
          @click="sidebarStore.toggle()"
        >
          <Menu class="h-5 w-5" />
        </Button>
        <a
          href="/"
          class="group flex items-center gap-1.5 text-lg transition-[color] duration-150 hover:opacity-90"
          aria-label="DevTools 首页"
        >
          <Wrench class="w-6 h-6 text-brand group-hover:-rotate-12 transition-[transform,color] duration-300 ease-out" />
          <span class="logo-text">DevTools</span>
        </a>
      </div>

      <!-- 快捷入口：清单由 quick-links.ts 驱动，lg 以下 hidden 不渲染 -->
      <nav
        v-if="quickLinks.length"
        aria-label="常用工具"
        class="hidden lg:flex items-center gap-1 min-w-0 mx-4"
      >
        <a
          v-for="t in quickLinks"
          :key="t.id"
          :href="t.path"
          :target="t.standalone ? '_blank' : undefined"
          :rel="t.standalone ? 'noopener noreferrer' : undefined"
          class="flex items-center gap-1.5 px-2 py-1 rounded-sm text-sm whitespace-nowrap transition-[background-color,color] duration-150 hover:bg-accent focus:outline-none"
          :class="currentPath === t.path ? 'bg-accent text-primary font-medium' : 'text-foreground'"
        >
          <span class="text-base shrink-0" aria-hidden="true">{{ t.icon }}</span>
          {{ t.name }}
        </a>
      </nav>

      <div class="flex items-center gap-3 ml-auto">
        <!-- 主题切换：直接使用 reka-ui 原语（浅色/暗色/跟随系统 三态）-->
        <DropdownMenuRoot>
          <DropdownMenuTrigger
            :class="buttonVariants({ variant: 'ghost', size: 'icon' })"
            :aria-label="`当前主题：${mode === 'system' ? '跟随系统' : current === 'dark' ? '暗色' : '浅色'}，点击切换`"
          >
            <Monitor v-if="mode === 'system'" class="h-5 w-5" />
            <Moon v-else-if="current === 'dark'" class="h-5 w-5" />
            <Sun v-else class="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              :side-offset="4"
              align="end"
              class="z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <DropdownMenuItem
                value="light"
                class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                @select="themeStore.apply('light')"
              >
                <Sun class="h-4 w-4" /> 浅色
                <Check v-if="mode === 'light'" class="ml-auto h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem
                value="dark"
                class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                @select="themeStore.apply('dark')"
              >
                <Moon class="h-4 w-4" /> 暗色
                <Check v-if="mode === 'dark'" class="ml-auto h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem
                value="system"
                class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                @select="themeStore.apply('system')"
              >
                <Monitor class="h-4 w-4" /> 跟随系统
                <Check v-if="mode === 'system'" class="ml-auto h-4 w-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>

        <!-- 仓库入口 -->
        <div class="flex items-center gap-2 text-foreground">
          <a href="https://gitee.com/baixuanz" target="_blank" rel="noopener noreferrer" class="focus:outline-none" aria-label="Gitee 仓库">
            <svg class="w-6 h-6" viewBox="0 0 24 24" role="img" aria-hidden="true" :fill="`#${siGitee.hex}`">
              <path :d="siGitee.path" />
            </svg>
          </a>
          <a href="https://github.com/BaixuanZhu/DevTools" target="_blank" rel="noopener noreferrer" class="focus:outline-none" aria-label="GitHub 仓库">
            <svg class="w-6 h-6" viewBox="0 0 24 24" role="img" aria-hidden="true" fill="currentColor">
              <path :d="siGithub.path" />
            </svg>
          </a>
        </div>
      </div>
    </header>

    <!-- 主体行 -->
    <div class="flex-1 flex min-h-0">
      <!-- 桌面端 Sidebar（静态常驻） -->
      <aside class="hidden lg:flex w-60 shrink-0 border-r border-border bg-card flex-col" role="navigation" aria-label="工具导航">
        <div class="flex-1 sidebar-nav-scroll overflow-y-auto py-2">
          <!-- 独立工作台一级菜单（新标签页打开，无徽标） -->
          <ul v-if="props.standaloneTools.length" class="list-none m-0 p-0 pb-1.5 mb-1.5 border-b border-border">
            <li class="px-4 pt-1 pb-1 text-[0.6875rem] text-muted-foreground select-none" aria-hidden="true">工作台</li>
            <li v-for="t in props.standaloneTools" :key="t.id">
              <a
                :href="t.path"
                target="_blank"
                rel="noopener noreferrer"
                :class="[
                  'flex items-center gap-2 px-4 py-2.5 text-sm transition-[background-color,color] duration-150 hover:bg-accent focus:outline-none',
                  currentPath === t.path ? 'bg-accent text-primary font-medium' : 'text-foreground',
                ]"
              >
                <span class="text-base w-6 text-center shrink-0">{{ t.icon }}</span>
                <span class="flex-1">{{ t.name }}</span>
                <ExternalLink class="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              </a>
            </li>
          </ul>
          <ul class="list-none m-0 p-0">
            <li v-for="cat in props.categories" :key="cat.slug">
              <a
                :href="renderCategory(cat).href"
                :class="[
                  'flex items-center gap-2 px-4 py-2.5 text-sm transition-[background-color,color] duration-150 hover:bg-accent focus:outline-none',
                  renderCategory(cat).active ? 'bg-accent text-primary font-medium' : 'text-foreground',
                ]"
              >
                <span class="text-base w-6 text-center shrink-0">{{ cat.icon }}</span>
                <span class="flex-1">{{ cat.name }}</span>
                <Badge variant="secondary" class="min-w-[1.5rem] justify-center tabular-nums">{{ renderCategory(cat).count }}</Badge>
              </a>
            </li>
          </ul>
        </div>
      </aside>

      <!-- 移动端 Sidebar（Sheet 抽屉） -->
      <Sheet :open="isOpen" @update:open="(v) => !v && sidebarStore.close()">
        <SheetContent side="left" class="w-72 p-0">
          <SheetHeader class="px-4 py-3 border-b border-border">
            <SheetTitle>工具导航</SheetTitle>
          </SheetHeader>
          <nav class="flex-1 sidebar-nav-scroll overflow-y-auto py-2" aria-label="工具导航（移动端）">
            <ul v-if="props.standaloneTools.length" class="list-none m-0 p-0 pb-1.5 mb-1.5 border-b border-border">
              <li class="px-4 pt-1 pb-1 text-[0.6875rem] text-muted-foreground select-none" aria-hidden="true">工作台</li>
              <li v-for="t in props.standaloneTools" :key="t.id">
                <a
                  :href="t.path"
                  target="_blank"
                  rel="noopener noreferrer"
                  :class="[
                    'flex items-center gap-2 px-4 py-2.5 text-sm transition-[background-color,color] duration-150 hover:bg-accent',
                    currentPath === t.path ? 'bg-accent text-primary font-medium' : 'text-foreground',
                  ]"
                >
                  <span class="text-base w-6 text-center shrink-0">{{ t.icon }}</span>
                  <span class="flex-1">{{ t.name }}</span>
                  <ExternalLink class="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                </a>
              </li>
            </ul>
            <ul class="list-none m-0 p-0">
              <li v-for="cat in props.categories" :key="cat.slug">
                <a
                  :href="renderCategory(cat).href"
                  :class="[
                    'flex items-center gap-2 px-4 py-2.5 text-sm transition-[background-color,color] duration-150 hover:bg-accent',
                    renderCategory(cat).active ? 'bg-accent text-primary font-medium' : 'text-foreground',
                  ]"
                >
                  <span class="text-base w-6 text-center shrink-0">{{ cat.icon }}</span>
                  <span class="flex-1">{{ cat.name }}</span>
                  <Badge variant="secondary" class="min-w-[1.5rem] justify-center tabular-nums">{{ renderCategory(cat).count }}</Badge>
                </a>
              </li>
            </ul>
          </nav>
        </SheetContent>
      </Sheet>

      <!-- 内容列 -->
      <slot />
    </div>

    <!-- 全局 Toaster（替代 ToastContainer.vue，全局任意位置 toast() 即可弹出） -->
    <Toaster />
  </div>
</template>
