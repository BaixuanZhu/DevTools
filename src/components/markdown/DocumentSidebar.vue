<script setup lang="ts">
/**
 * Markdown 工作台文档列表侧栏（工作台私有子组件）。
 *
 * 职责：展示多文档草稿清单（按更新时间降序，排序由 doc-store 保证），
 * 提供新建 / 切换 / 双击重命名 / 删除（确认弹窗防误删）入口与空状态引导。
 * 数据操作全部经 emits 交由主岛落 doc-store，本组件不直接触碰持久化。
 */
import { ref, nextTick } from 'vue';
import { Trash2, FilePlus2 } from '@lucide/vue';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from '../ui/dialog';
import type { MarkdownDoc } from '../../tools/markdown/doc-store';

interface Props {
  /** 文档清单（已按 updatedAt 降序排列） */
  docs: MarkdownDoc[];
  /** 当前选中的文档 ID；无选中时为 null */
  activeId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 选中某个文档 */
  select: [id: string];
  /** 新建文档 */
  create: [];
  /** 重命名文档 */
  rename: [id: string, title: string];
  /** 删除文档（已经过用户确认） */
  remove: [id: string];
}>();

/** 正在行内编辑标题的文档 ID（null 表示无编辑状态） */
const renamingId = ref<string | null>(null);
/** 行内编辑标题的草稿值 */
const renameDraft = ref('');
/** 行内重命名输入框元素（进入编辑态后聚焦全选）；函数 ref 规避 v-for 作用域下模板 ref 的数组化行为 */
const renameInputRef = ref<HTMLInputElement | null>(null);

/**
 * 函数式模板 ref：只接受 HTMLInputElement，其余（卸载时的 null）清空。
 * @param el 模板节点或 null
 */
function setRenameInput(el: unknown): void {
  renameInputRef.value = el instanceof HTMLInputElement ? el : null;
}
/** 待删除文档（非 null 时渲染确认弹窗） */
const pendingDelete = ref<MarkdownDoc | null>(null);

/**
 * 把时间戳格式化为简短展示：今天 → HH:mm，今年 → MM-DD，更早 → 年份。
 * @param ts 毫秒时间戳
 * @returns 格式化文案
 */
function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN');
}

/**
 * 进入某文档的行内重命名编辑态（双击触发），下一帧聚焦并全选文本。
 * @param doc 目标文档
 */
function startRename(doc: MarkdownDoc): void {
  renamingId.value = doc.id;
  renameDraft.value = doc.title;
  void nextTick(() => {
    const input = renameInputRef.value;
    if (input) {
      input.focus();
      input.select();
    }
  });
}

/** 提交行内重命名（Enter / 失焦时触发）；草稿为空或未变更则静默退出编辑态 */
function commitRename(): void {
  const id = renamingId.value;
  renamingId.value = null;
  if (!id) return;
  const title = renameDraft.value.trim();
  const current = props.docs.find((d) => d.id === id)?.title ?? '';
  if (title === '' || title === current) return;
  emit('rename', id, title);
}

/** 取消行内重命名（Esc） */
function cancelRename(): void {
  renamingId.value = null;
}

/**
 * 点击删除图标：进入确认弹窗态（防误删，不直接删除）。
 * @param doc 目标文档
 */
function askDelete(doc: MarkdownDoc): void {
  pendingDelete.value = doc;
}

/** 确认弹窗中的「删除」：关闭弹窗并向主岛发出删除事件 */
function confirmDelete(): void {
  if (!pendingDelete.value) return;
  emit('remove', pendingDelete.value.id);
  pendingDelete.value = null;
}
</script>

<template>
  <div class="flex flex-col min-h-0 h-full">
    <!-- 头部：标题 + 新建 -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
      <span class="text-[0.8125rem] font-medium text-muted-foreground">草稿箱</span>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        aria-label="新建文档"
        title="新建文档"
        @click="emit('create')"
      >
        <FilePlus2 class="h-4 w-4" />
      </Button>
    </div>

    <!-- 空状态引导 -->
    <div v-if="docs.length === 0" class="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p class="text-sm text-muted-foreground">暂无文档</p>
      <Button variant="outline" size="sm" @click="emit('create')">新建第一篇</Button>
    </div>

    <!-- 文档清单 -->
    <ul v-else class="flex-1 overflow-y-auto py-1 list-none m-0 p-0">
      <li v-for="doc in docs" :key="doc.id">
        <div
          v-if="renamingId === doc.id"
          class="px-2 py-1.5"
        >
          <input
            :ref="setRenameInput"
            v-model="renameDraft"
            type="text"
            class="w-full bg-card text-foreground border border-primary rounded-sm px-2 py-1 text-sm focus:outline-none"
            aria-label="文档标题"
            @keydown.enter.prevent="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
        </div>
        <!-- 文档行：标题按钮与删除按钮为同级兄弟，避免 button 内嵌 role=button 的 a11y 问题 -->
        <div
          v-else
          class="w-full flex items-start gap-2 px-3 py-2 text-sm"
          :class="doc.id === activeId ? 'bg-accent' : ''"
        >
          <button
            type="button"
            class="flex-1 min-w-0 text-left transition-[background-color] duration-150 hover:bg-accent focus:outline-none"
            :class="doc.id === activeId ? 'text-primary font-medium' : 'text-foreground'"
            :aria-current="doc.id === activeId ? 'true' : undefined"
            @click="emit('select', doc.id)"
            @dblclick="startRename(doc)"
          >
            <span class="block truncate">{{ doc.title }}</span>
            <span class="block text-[0.6875rem] text-muted-foreground tabular-nums">{{ formatTime(doc.updatedAt) }}</span>
          </button>
          <button
            type="button"
            class="shrink-0 p-1 rounded-sm text-muted-foreground hover:text-destructive transition-[color] duration-150"
            :aria-label="`删除文档：${doc.title}`"
            @click="askDelete(doc)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    </ul>

    <!-- 删除确认弹窗（防误删） -->
    <Dialog :open="pendingDelete !== null" @update:open="(v) => !v && (pendingDelete = null)">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>删除文档</DialogTitle>
          <DialogDescription>
            确定删除「{{ pendingDelete?.title }}」吗？该操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2">
          <DialogClose as-child>
            <Button variant="outline" size="sm">取消</Button>
          </DialogClose>
          <Button variant="destructive" size="sm" @click="confirmDelete">删除</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
