<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getToolsByCategory, getCategories } from '../../data/tools';

const props = defineProps<{
  /** 当前页面路径，用于高亮匹配的导航项 */
  currentPath: string;
}>();

/** 侧边栏展开状态（组件内部管理） */
const isOpen = ref(false);

const categories = getCategories();
const toolsByCategory = getToolsByCategory();

/** 判断工具是否为当前激活项 */
function isActive(path: string): boolean {
  return props.currentPath === path;
}

function close() {
  isOpen.value = false;
  document.dispatchEvent(new CustomEvent('sidebar-close'));
}

function toggle() {
  isOpen.value = !isOpen.value;
}

/** Escape 键关闭侧边栏 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close();
  }
}

/** 监听 Header 汉堡菜单的 DOM 自定义事件 */
function handleSidebarToggle() {
  toggle();
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('sidebar-toggle', handleSidebarToggle);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('sidebar-toggle', handleSidebarToggle);
});
</script>

<template>
  <!-- 遮罩层 -->
  <div
    v-if="isOpen"
    class="sidebar-overlay"
    role="presentation"
    @click="close"
  />
  <aside
    :class="['sidebar', { 'sidebar--open': isOpen }]"
    role="navigation"
    aria-label="工具导航"
  >
    <nav class="sidebar-nav">
      <div class="sidebar-home">
        <a
          href="/"
          :class="['sidebar-link', { 'sidebar-link--active': isActive('/') }]"
        >
          <span class="sidebar-icon">🏠</span>
          <span class="sidebar-name">首页</span>
        </a>
      </div>
      <div class="sidebar-divider" />
      <div v-for="category in categories" :key="category" class="sidebar-group">
        <h3 class="sidebar-group-title">{{ category }}</h3>
        <ul class="sidebar-list">
          <li v-for="tool in toolsByCategory[category]" :key="tool.id">
            <a
              :href="tool.path"
              :class="['sidebar-link', { 'sidebar-link--active': isActive(tool.path) }]"
            >
              <span class="sidebar-icon">{{ tool.icon }}</span>
              <span class="sidebar-name">{{ tool.name }}</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar-overlay {
  display: none;
}

.sidebar {
  width: var(--sidebar-width);
  height: calc(100vh - var(--header-height) - 49px);
  overflow-y: auto;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-card);
  padding: var(--space-sm) 0;
  flex-shrink: 0;
}

.sidebar-home {
  padding: var(--space-xs) 0;
}

.sidebar-divider {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--space-xs) var(--space-md);
}

.sidebar-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  padding: var(--space-md) var(--space-md) var(--space-xs);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text);
  font-size: 0.875rem;
  transition: background-color var(--transition-fast);
  border-radius: 0;
}

.sidebar-link:hover {
  background-color: var(--color-hover);
}

.sidebar-link--active {
  background-color: var(--color-hover);
  color: var(--color-accent);
  font-weight: 500;
  border-right: 2px solid var(--color-accent);
}

.sidebar-icon {
  font-size: 1rem;
  width: 1.5rem;
  text-align: center;
  flex-shrink: 0;
}

@media (max-width: 1023px) {
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 99;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: var(--header-height);
    z-index: 100;
    transform: translateX(-100%);
    transition: transform var(--transition-normal);
    height: calc(100vh - var(--header-height));
  }

  .sidebar--open {
    transform: translateX(0);
  }
}
</style>
