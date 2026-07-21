<script setup lang="ts">
/**
 * 全局应用壳层（ToolLayout 唯一 client:load 岛）。
 *
 * 渲染 Header（汉堡 + Logo + 收藏入口 + 暗色按钮 + 仓库链接）、
 * Sidebar（桌面常驻 / 移动抽屉）、移动 Overlay，并通过默认 slot
 * 承载页面内容列（由 Astro server 渲染注入）。
 *
 * 响应式状态来自模块级单例 store（sidebarStore / themeStore），
 * onMounted 预热 favorites/theme 的 localStorage 读取。
 */
import { onMounted, onUnmounted } from 'vue';
import { Wrench, Sun, Moon } from '@lucide/vue';
import { siGithub, siGitee } from 'simple-icons';
import type { ToolMeta } from '../../data/tools';
import { sidebarStore } from '../../stores/sidebar';
import { themeStore } from '../../stores/theme';
import { favoritesStore } from '../../stores/favorites';

interface Props {
  /** 分类列表（顺序保持注册顺序） */
  categories: string[];
  /** 分类 → 工具列表映射 */
  toolsByCategory: Record<string, Pick<ToolMeta, 'id' | 'path' | 'name' | 'icon'>[]>;
  /** 当前路径（用于侧栏高亮），格式如 /text/uuid-generator */
  currentPath: string;
}
const props = defineProps<Props>();

const { isOpen } = sidebarStore;
const { current } = themeStore;

/** ESC 关闭侧栏（移动端） */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') sidebarStore.close();
}
onMounted(() => {
  themeStore.load();
  favoritesStore.load();
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function toggleTheme(): void {
  themeStore.toggle();
}
</script>

<template>
  <div id="app" class="h-dvh flex flex-col overflow-hidden">
    <!-- Header（通栏，横跨全宽） -->
    <header class="flex items-center justify-between px-6 py-2 border-b border-border bg-card h-[57px] shrink-0">
      <!-- 左侧：汉堡按钮（mobile-only） + Logo -->
      <div class="flex items-center gap-4">
        <button
          class="hidden max-lg:flex flex-col gap-1 p-2 border-none bg-transparent cursor-pointer focus:outline-none"
          aria-label="打开导航菜单"
          :aria-expanded="isOpen"
          @click="sidebarStore.toggle()"
        >
          <span class="block w-[18px] h-[2px] bg-foreground rounded-[1px]" aria-hidden="true"></span>
          <span class="block w-[18px] h-[2px] bg-foreground rounded-[1px]" aria-hidden="true"></span>
          <span class="block w-[18px] h-[2px] bg-foreground rounded-[1px]" aria-hidden="true"></span>
        </button>
        <a
          href="/"
          class="group flex items-center gap-1.5 text-lg font-semibold text-foreground hover:text-primary transition-[color] duration-150"
          aria-label="DevTools 首页"
        >
          <Wrench class="w-6 h-6 text-violet-600 group-hover:text-primary group-hover:-rotate-12 transition-[transform,color] duration-300 ease-out" />
          <span>DevTools</span>
        </a>
      </div>

      <!-- 右侧：工具按钮区 + 仓库入口 -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1">
          <!-- 收藏夹入口 -->
          <a
            href="/favorites"
            class="flex items-center gap-1.5 h-9 px-2 max-md:px-1.5 rounded-sm text-muted-foreground hover:text-primary hover:bg-accent transition-[color,background-color] duration-150 focus:outline-none"
            aria-label="我的收藏"
          >
            <span class="text-[1.125rem] leading-none">⭐</span>
            <span class="text-[0.8125rem] font-medium max-md:hidden">我的收藏</span>
          </a>

          <!-- 暗色模式按钮 -->
          <button
            class="flex items-center justify-center w-9 h-9 rounded-sm text-muted-foreground hover:text-primary hover:bg-accent transition-[color,background-color] duration-150 cursor-pointer border-none bg-transparent focus:outline-none"
            :aria-label="current === 'dark' ? '切换到亮色模式' : '切换到暗色模式'"
            @click="toggleTheme"
          >
            <Moon v-if="current === 'dark'" class="w-5 h-5" />
            <Sun v-else class="w-5 h-5" />
          </button>
        </div>

        <!-- 仓库入口 -->
        <div class="flex items-center gap-2 text-foreground">
          <a
            href="https://gitee.com/baixuanz"
            target="_blank"
            rel="noopener noreferrer"
            class="focus:outline-none"
            aria-label="Gitee 仓库"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" role="img" aria-hidden="true" :fill="`#${siGitee.hex}`">
              <path :d="siGitee.path" />
            </svg>
          </a>
          <a
            href="https://github.com/BaixuanZhu/DevTools"
            target="_blank"
            rel="noopener noreferrer"
            class="focus:outline-none"
            aria-label="GitHub 仓库"
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" role="img" aria-hidden="true" fill="currentColor">
              <path :d="siGithub.path" />
            </svg>
          </a>
        </div>
      </div>
    </header>

    <!-- 主体行：aside + 内容列 -->
    <div class="flex-1 flex min-h-0">
      <!-- Sidebar（桌面静态；移动端抽屉，定位见 <style>） -->
      <aside
        :class="['sidebar', 'w-60', 'shrink-0', 'border-r', 'border-border', 'bg-card', 'flex', 'flex-col', isOpen && 'sidebar-open']"
        role="navigation"
        aria-label="工具导航"
      >
        <div class="flex-1 sidebar-nav-scroll overflow-y-auto py-2">
          <div v-for="category in props.categories" :key="category">
            <h3 class="text-xs font-semibold text-muted-foreground px-4 py-4 pb-1 uppercase tracking-wider">{{ category }}</h3>
            <ul class="list-none m-0 p-0">
              <li v-for="tool in props.toolsByCategory[category]" :key="tool.id">
                <a
                  :href="tool.path"
                  :class="[
                    'flex items-center gap-2 px-4 py-2 text-sm text-foreground transition-[background-color] duration-150 hover:bg-accent focus:outline-none',
                    props.currentPath === tool.path && 'bg-accent text-primary font-medium',
                  ]"
                >
                  <span class="text-base w-6 text-center shrink-0">{{ tool.icon }}</span>
                  <span>{{ tool.name }}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <!-- Mobile overlay -->
      <div
        v-if="isOpen"
        class="sidebar-overlay fixed inset-0 bg-black/30 z-[99]"
        @click="sidebarStore.close()"
      ></div>

      <!-- 内容列（Astro server 渲染注入：main + footer 等） -->
      <slot />
    </div>
  </div>
</template>

<style>
  /* 移动端侧栏：从 header 下方滑出，header 常驻可见 */
  @media (max-width: 1023px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 57px;
      z-index: 100;
      height: calc(100dvh - 57px);
      transform: translateX(-100%);
      transition: transform 250ms ease;
    }
    .sidebar.sidebar-open {
      transform: translateX(0);
    }
    .sidebar-overlay {
      top: 57px;
    }
  }
  /* 桌面端不显示 overlay（aside 静态常驻） */
  @media (min-width: 1024px) {
    .sidebar-overlay {
      display: none;
    }
  }
</style>
