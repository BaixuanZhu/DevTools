<script setup lang="ts">
/**
 * docker run 参数速查表组件。
 *
 * 按分类以表格形式展示常用 flag，支持一键复制示例命令。
 */
import { computed } from 'vue';
import CopyButton from '../../../components/ui/CopyButton.vue';
import { RUN_FLAGS, RUN_FLAG_CATEGORIES } from '../../../utils/docker/run-flags-data';

/**
 * 按分类分组后的 flag 数据。
 */
const groupedFlags = computed(() => {
  return RUN_FLAG_CATEGORIES.map((category) => ({
    category,
    items: RUN_FLAGS.filter((f) => f.category === category),
  })).filter((group) => group.items.length > 0);
});
</script>

<template>
  <div class="w-full">
    <h2 class="text-lg font-semibold mb-4">docker run 常用参数速查</h2>

    <div
      v-for="group in groupedFlags"
      :key="group.category"
      class="mb-6"
    >
      <h3 class="text-[0.8125rem] font-medium text-muted mb-2">{{ group.category }}</h3>

      <div class="border border-border rounded-sm overflow-hidden">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-hover border-b border-border">
              <th class="px-4 py-2 text-left text-[0.8125rem] font-medium text-muted w-1/4">Flag</th>
              <th class="px-4 py-2 text-left text-[0.8125rem] font-medium text-muted w-1/3">说明</th>
              <th class="px-4 py-2 text-left text-[0.8125rem] font-medium text-muted">示例</th>
              <th class="px-4 py-2 text-right text-[0.8125rem] font-medium text-muted w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in group.items"
              :key="item.flag"
              class="border-b border-border last:border-b-0 bg-card transition-[background-color] duration-150 hover:bg-hover"
            >
              <td class="px-4 py-2.5 font-mono text-sm text-text align-top">{{ item.flag }}</td>
              <td class="px-4 py-2.5 text-[0.8125rem] text-text align-top">{{ item.description }}</td>
              <td class="px-4 py-2.5 font-mono text-sm text-muted align-top whitespace-pre-wrap break-all">{{ item.example }}</td>
              <td class="px-4 py-2.5 text-right align-top">
                <CopyButton
                  :text="item.example"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
