<script setup lang="ts">
/**
 * 转盘抽奖工具组件。
 *
 * - 左侧：结构化选项列表（名称+权重）、批量粘贴导入、操作按钮
 * - 右侧：Canvas 转盘与旋转动画（后续任务填充）
 */
import { ref } from 'vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  type WheelItem,
  MAX_ITEMS,
  normalizeWeight,
  parseBatch,
  DEFAULT_ITEMS,
} from '../../utils/text/wheel';

/** 活跃选项（可被抽中），唯一真相源 */
const items = ref<WheelItem[]>(DEFAULT_ITEMS.map((it) => ({ ...it })));
/** 批量导入文本框内容 */
const batchText = ref('');

/** 触发全局 toast 通知 */
function showToast(message: string): void {
  document.dispatchEvent(new CustomEvent('toast', { detail: { message } }));
}

/** 新增一个空选项 */
function addItem(): void {
  if (items.value.length >= MAX_ITEMS) {
    showToast(`选项数量已达上限 ${MAX_ITEMS} 个`);
    return;
  }
  items.value.push({ text: '', weight: 1 });
}

/** 删除指定下标选项 */
function removeItem(index: number): void {
  items.value.splice(index, 1);
}

/** 失焦时归一化权重输入 */
function normalizeItemWeight(index: number): void {
  items.value[index].weight = normalizeWeight(Number(items.value[index].weight));
}

/** 将批量文本解析后追加到现有列表（按名称去重，受上限约束） */
function importBatch(): void {
  const parsed = parseBatch(batchText.value);
  if (parsed.length === 0) {
    showToast('没有可导入的选项');
    return;
  }
  const existing = new Set(items.value.map((it) => it.text));
  let added = 0;
  for (const it of parsed) {
    if (items.value.length >= MAX_ITEMS) break;
    if (existing.has(it.text)) continue;
    existing.add(it.text);
    items.value.push(it);
    added++;
  }
  batchText.value = '';
  showToast(added > 0 ? `已导入 ${added} 个选项` : '选项已存在，未新增');
}

/** 清空：恢复默认示例 */
function clearAll(): void {
  items.value = DEFAULT_ITEMS.map((it) => ({ ...it }));
  batchText.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="转盘抽奖"
      description="自定义选项，旋转转盘随机抽取，支持权重、不重复抽取与配置分享"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <div class="flex flex-col gap-4">
          <!-- 选项列表 -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[0.8125rem] text-muted">选项（{{ items.length }}/{{ MAX_ITEMS }}）</span>
              <button
                class="text-[0.8125rem] text-accent hover:underline cursor-pointer bg-transparent border-0 p-0"
                @click="addItem"
              >
                + 添加选项
              </button>
            </div>
            <div
              v-for="(item, index) in items"
              :key="index"
              class="flex items-center gap-2"
            >
              <input
                v-model="item.text"
                type="text"
                placeholder="选项名称"
                class="flex-1 min-w-0 px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
              />
              <input
                v-model.number="item.weight"
                type="number"
                min="1"
                step="1"
                title="权重"
                class="w-16 px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent"
                @blur="normalizeItemWeight(index)"
              />
              <button
                class="shrink-0 px-2 py-1.5 text-muted hover:text-text cursor-pointer bg-transparent border-0"
                title="删除"
                @click="removeItem(index)"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- 批量导入 -->
          <div class="flex flex-col gap-2">
            <span class="text-[0.8125rem] text-muted">批量导入（每行一个选项）</span>
            <textarea
              v-model="batchText"
              rows="4"
              placeholder="粘贴多行文本，每行一个选项&#10;张三&#10;李四&#10;王五"
              class="w-full px-2 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-mono resize-y focus:outline-none focus:border-accent"
            ></textarea>
            <button
              class="self-start px-4 py-2 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent"
              @click="importBatch"
            >
              导入
            </button>
          </div>
        </div>
      </template>

      <template #actions>
        <ClearButton @clear="clearAll" />
      </template>

      <template #output>
        <div class="text-sm text-muted">转盘建设中…</div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
