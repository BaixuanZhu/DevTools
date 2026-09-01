<script setup lang="ts">
/**
 * HTML 导出预览对话框（Markdown 工作台消费）。
 *
 * 预览与下载共用 buildHtmlDocument 产物，保证所见即所得：主题切换即时重建 srcdoc；
 * iframe 以 sandbox="allow-scripts"（无 allow-same-origin）隔离在不透明源，
 * 预览内嵌的主题切换器真实可用，且产物脚本无法触碰父页面与站点存储。
 * 导出文件内嵌全部主题，此处选中的主题烘为打开文件时的默认值。
 */
import { computed, ref } from 'vue';
import { Download } from '@lucide/vue';
import { Button, buttonVariants } from '../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toastStore } from '../../stores/toast';
import {
  buildHtmlDocument,
  DEFAULT_HTML_THEME_ID,
  exportHtml,
  HTML_EXPORT_THEMES,
} from '../../utils/editor/markdown-export';

const props = defineProps<{
  /** 对话框开合（v-model:open） */
  open: boolean;
  /** 待导出的 Markdown 源文本 */
  markdown: string;
  /** 文档标题（注入产物 <title>） */
  title: string;
  /** 下载文件名 */
  filename: string;
}>();

const emit = defineEmits<{ 'update:open': [value: boolean] }>();

/** 当前选中的导出主题（打开文件时的默认主题；跨多次打开保留上次选择） */
const themeId = ref<string>(DEFAULT_HTML_THEME_ID);

/** 预览产物：与下载共用同一条生成路径，主题变更即时重建 srcdoc */
const previewDoc = computed(() =>
  buildHtmlDocument(props.markdown, { themeId: themeId.value, title: props.title }),
);

/** 按当前主题下载 HTML 文件，成功后反馈并关闭对话框 */
function handleDownload(): void {
  try {
    exportHtml(props.markdown, props.filename, { themeId: themeId.value, title: props.title });
    toastStore.show('已导出 HTML 文件');
    emit('update:open', false);
  } catch {
    toastStore.error('导出失败，请重试');
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-4xl h-[80vh] grid grid-rows-[auto_auto_1fr_auto] gap-3">
      <DialogHeader>
        <DialogTitle>导出 HTML 预览</DialogTitle>
        <DialogDescription>
          选择主题查看导出效果；导出文件内置全部主题并自带切换器，打开后仍可随时切换。
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="导出主题" class="flex flex-wrap gap-1.5">
        <button
          v-for="theme in HTML_EXPORT_THEMES"
          :key="theme.id"
          type="button"
          role="radio"
          :aria-checked="themeId === theme.id"
          :class="buttonVariants({ variant: themeId === theme.id ? 'default' : 'outline', size: 'sm' })"
          @click="themeId = theme.id"
        >
          {{ theme.name }}
        </button>
      </div>

      <div class="min-h-0 rounded-md border border-border overflow-hidden bg-card">
        <iframe
          :srcdoc="previewDoc"
          sandbox="allow-scripts"
          title="导出 HTML 预览"
          class="w-full h-full border-0"
        ></iframe>
      </div>

      <div class="flex justify-end gap-2">
        <DialogClose :class="buttonVariants({ variant: 'outline' })">取消</DialogClose>
        <Button @click="handleDownload">
          <Download class="h-4 w-4" /> 下载 HTML
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
