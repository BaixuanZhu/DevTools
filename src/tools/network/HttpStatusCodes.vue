<script setup lang="ts">
import { ref, computed } from 'vue';
import { Search } from '@lucide/vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import {
  HTTP_STATUSES,
  STATUS_CATEGORIES,
  type StatusCategory,
  type HttpStatusEntry,
} from '../../utils/network/http-status-data';

/** 分类筛选状态，'all' 表示全部 */
const activeCategory = ref<StatusCategory | 'all'>('all');
/** 搜索关键词 */
const searchQuery = ref('');

/**
 * 根据分类和关键词过滤状态码列表
 */
const filteredStatuses = computed(() => {
  let list: HttpStatusEntry[] = HTTP_STATUSES;

  if (activeCategory.value !== 'all') {
    list = list.filter((s) => s.category === activeCategory.value);
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        String(s.code).includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }

  return list;
});

/** 当前过滤后的结果数量 */
const resultCount = computed(() => filteredStatuses.value.length);

/** 用于复制全部结果的文本 */
const allStatusText = computed(() =>
  filteredStatuses.value.map((s) => `${s.code} ${s.name}: ${s.description}`).join('\n'),
);

/**
 * 清空所有筛选条件
 */
function handleClear() {
  searchQuery.value = '';
  activeCategory.value = 'all';
}

/**
 * 获取分类对应的颜色 class
 */
function getCategoryColor(category: StatusCategory): string {
  const colors: Record<StatusCategory, string> = {
    '1xx': 'bg-blue-100 text-blue-800',
    '2xx': 'bg-green-100 text-green-800',
    '3xx': 'bg-yellow-100 text-yellow-800',
    '4xx': 'bg-orange-100 text-orange-800',
    '5xx': 'bg-red-100 text-red-800',
  };
  return colors[category];
}
</script>

<template>
  <div class="w-full">
    <ToolHeader
      title="HTTP 状态码查询"
      description="查询 HTTP 状态码含义，支持分类筛选与关键词搜索"
      :show-example="false"
    />

    <!-- 分类筛选按钮组 -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        :class="[
          'px-3 py-1.5 text-[0.8125rem] rounded-sm border cursor-pointer transition-[background-color,border-color,color] duration-150',
          activeCategory === 'all'
            ? 'bg-accent text-white border-accent'
            : 'bg-card text-muted border-border hover:bg-hover hover:border-accent hover:text-text',
        ]"
        @click="activeCategory = 'all'"
      >
        全部
      </button>
      <button
        v-for="cat in STATUS_CATEGORIES"
        :key="cat.key"
        :class="[
          'px-3 py-1.5 text-[0.8125rem] rounded-sm border cursor-pointer transition-[background-color,border-color,color] duration-150',
          activeCategory === cat.key
            ? 'bg-accent text-white border-accent'
            : 'bg-card text-muted border-border hover:bg-hover hover:border-accent hover:text-text',
        ]"
        @click="activeCategory = cat.key"
      >
        {{ cat.key }} {{ cat.label }}
      </button>
    </div>

    <!-- 搜索 + 操作栏 -->
    <div class="flex items-center gap-3 mb-4">
      <div class="flex-1 relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索状态码或描述..."
          class="w-full pl-10 pr-4 py-2 border border-border rounded-sm bg-surface text-text text-[0.8125rem] placeholder:text-muted/60 outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
      <button
        class="shrink-0 px-4 py-2 border border-border rounded-sm bg-card text-muted text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:border-accent hover:text-text"
        @click="handleClear"
      >
        清空
      </button>
      <CopyButton
        v-if="filteredStatuses.length > 0"
        :text="allStatusText"
      />
    </div>

    <!-- 结果计数 -->
    <p class="text-[0.8125rem] text-muted mb-3">
      共 {{ resultCount }} 个状态码
    </p>

    <!-- 状态码列表 -->
    <div
      v-if="filteredStatuses.length > 0"
      class="flex flex-col gap-2"
    >
      <div
        v-for="status in filteredStatuses"
        :key="status.code"
        class="flex items-start gap-4 px-4 py-3 border border-border rounded-sm bg-card transition-[border-color] duration-150 hover:border-accent"
      >
        <!-- 状态码 -->
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-lg font-mono font-bold text-text min-w-[40px]">{{ status.code }}</span>
          <span
            :class="['px-2 py-0.5 text-[0.6875rem] font-semibold rounded-sm', getCategoryColor(status.category)]"
          >
            {{ status.category }}
          </span>
        </div>

        <!-- 名称和描述 -->
        <div class="flex-1 min-w-0">
          <p class="text-[0.8125rem] font-medium text-text m-0 mb-0.5">{{ status.name }}</p>
          <p class="text-[0.8125rem] text-muted m-0">{{ status.description }}</p>
          <p v-if="status.spec" class="text-[0.6875rem] text-muted/60 m-0 mt-1">{{ status.spec }}</p>
        </div>

        <!-- 复制按钮 -->
        <CopyButton
          :text="String(status.code)"
          class="shrink-0"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-12 text-muted"
    >
      <Search class="w-10 h-10 mb-3 text-muted/40" :stroke-width="1.5" />
      <p class="text-[0.8125rem] m-0">未找到匹配的状态码</p>
    </div>
  </div>
</template>
