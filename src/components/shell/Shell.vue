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
 */
import { onMounted } from 'vue';
import { Wrench, Sun, Moon, Menu, Check } from '@lucide/vue';
import { siGithub, siGitee } from 'simple-icons';
import type { ToolMeta } from '../../data/tools';
import type { CategoryMeta } from '../../data/categories';
import { sidebarStore } from '../../stores/sidebar';
import { themeStore } from '../../stores/theme';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Toaster } from '../ui/sonner';

interface Props {
  categories: CategoryMeta[];
  toolsByCategory: Record<string, Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon'>[]>;
  currentPath: string;
}
const props = defineProps<Props>();

const { isOpen } = sidebarStore;
const { current } = themeStore;

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

      <div class="flex items-center gap-3">
        <!-- 主题切换：DropdownMenu（替代单按钮，为后续"跟随系统"留扩展）-->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" :aria-label="current === 'dark' ? '切换到亮色模式' : '切换到暗色模式'">
              <Moon v-if="current === 'dark'" class="h-5 w-5" />
              <Sun v-else class="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem class="gap-2" @select="themeStore.set('light')">
              <Sun class="h-4 w-4" /> 浅色 <Check v-if="current === 'light'" class="ml-auto h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuItem class="gap-2" @select="themeStore.set('dark')">
              <Moon class="h-4 w-4" /> 暗色 <Check v-if="current === 'dark'" class="ml-auto h-4 w-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
