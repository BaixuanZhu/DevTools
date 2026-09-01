<script setup lang="ts">
/**
 * Markdown 工作台主岛（/markdown 独立页的全屏应用）。
 *
 * 页面形态为完全独立（无站点壳层），本岛自含站点级职责：
 * - onMounted 调 themeStore.load() 恢复主题，顶栏提供三态切换控件（与 Shell 同款交互）
 * - 挂载 vue-sonner <Toaster />（独立页没有 Shell，toastStore 必须有渲染目标）
 *
 * 内核 md-editor-v3：分栏/仅编辑/仅预览的视图切换由其内置工具栏提供（preview / previewOnly 按钮）
 * + 多文档草稿箱（doc-store 自动保存）+ 图片粘贴/拖拽 base64 内联 + 导入 .md / 导出
 * md·html（预览对话框选主题）·PDF。
 *
 * 扩展库全量本地化：md-editor-v3 默认在运行时从 unpkg CDN 加载 mermaid/katex/highlight.js/
 * prettier/cropper/screenfull/echarts（面向国内用户可达性不稳定），此处通过 config() 注入本地实例，
 * 守卫逻辑为「有 instance 即不再追加对应 CDN script/link」（源码已核实），运行时零 CDN 请求；
 * 被替代的 CDN 样式（katex 字体、cropper、hljs 主题）由本组件自行 import，暗色 hljs 主题
 * 以 .dark 作用域覆盖浅色基底。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { MdEditor, config } from 'md-editor-v3';
// md-editor-v3 6.x 样式引入：style.css 为编辑器全量样式（含内置预览区样式）
import 'md-editor-v3/lib/style.css';
import type { ToolbarNames, UploadImgCallBack, UploadImgEvent } from 'md-editor-v3';

// ---- md-editor 扩展库本地实例（替代 unpkg CDN，见文件头说明）----
import hljs from 'highlight.js/lib/core';
import javascriptLang from 'highlight.js/lib/languages/javascript';
import typescriptLang from 'highlight.js/lib/languages/typescript';
import xmlLang from 'highlight.js/lib/languages/xml';
import cssLang from 'highlight.js/lib/languages/css';
import jsonLang from 'highlight.js/lib/languages/json';
import markdownLang from 'highlight.js/lib/languages/markdown';
import yamlLang from 'highlight.js/lib/languages/yaml';
import bashLang from 'highlight.js/lib/languages/bash';
import pythonLang from 'highlight.js/lib/languages/python';
import sqlLang from 'highlight.js/lib/languages/sql';
import javaLang from 'highlight.js/lib/languages/java';
import goLang from 'highlight.js/lib/languages/go';
import rustLang from 'highlight.js/lib/languages/rust';
import cLang from 'highlight.js/lib/languages/c';
import cppLang from 'highlight.js/lib/languages/cpp';
import csharpLang from 'highlight.js/lib/languages/csharp';
import diffLang from 'highlight.js/lib/languages/diff';
import dockerfileLang from 'highlight.js/lib/languages/dockerfile';
import iniLang from 'highlight.js/lib/languages/ini';
import phpLang from 'highlight.js/lib/languages/php';
import rubyLang from 'highlight.js/lib/languages/ruby';
import powershellLang from 'highlight.js/lib/languages/powershell';
import makefileLang from 'highlight.js/lib/languages/makefile';
import * as prettier from 'prettier/standalone';
import * as prettierMarkdownPlugin from 'prettier/plugins/markdown';
// cropperjs1 是 cropperjs@1 的 pnpm 别名：md-editor 的裁剪弹窗仅兼容 v1 API，
// 而项目 ImageCropper.vue 依赖顶层 cropperjs@2 的 web-components API，两者以别名共存
import Cropper from 'cropperjs1';
import screenfull from 'screenfull';
import mermaid from 'mermaid';
import katex from 'katex';
import * as echarts from 'echarts';
// instance 注入后 md-editor 不再追加对应 CDN link，样式须本地引入；
// hljs 主题取 codeTheme 默认值 atom：浅色全局基底 + .dark 作用域覆盖（见文件尾部样式块）
import 'katex/dist/katex.min.css';
import 'cropperjs1/dist/cropper.css';
import 'highlight.js/styles/atom-one-light.css';

import {
  Check, Download, FilePlus2, FileUp, Monitor, Moon, PanelLeft, Sun,
} from '@lucide/vue';
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal } from 'reka-ui';
import { Button, buttonVariants } from '../../components/ui/button';
import { DropdownMenuContent, DropdownMenuItem } from '../../components/ui/dropdown-menu';
import { Toaster } from '../../components/ui/sonner';
import DocumentSidebar from '../../components/markdown/DocumentSidebar.vue';
import HtmlExportDialog from '../../components/markdown/HtmlExportDialog.vue';
import { themeStore } from '../../stores/theme';
import { toastStore } from '../../stores/toast';
import { createDoc, deleteDoc, listDocs, renameDoc, saveDoc, type MarkdownDoc } from './doc-store';
import { exportMarkdown, exportPdf } from '../../utils/editor/markdown-export';

/** 注册代码高亮语言（hljs core + 按需语言，等价旧 CDN 全量包中面向开发者的高频子集） */
const HIGHLIGHT_LANGUAGES: Array<[string, Parameters<typeof hljs.registerLanguage>[1]]> = [
  ['javascript', javascriptLang],
  ['typescript', typescriptLang],
  ['xml', xmlLang],
  ['css', cssLang],
  ['json', jsonLang],
  ['markdown', markdownLang],
  ['yaml', yamlLang],
  ['bash', bashLang],
  ['python', pythonLang],
  ['sql', sqlLang],
  ['java', javaLang],
  ['go', goLang],
  ['rust', rustLang],
  ['c', cLang],
  ['cpp', cppLang],
  ['csharp', csharpLang],
  ['diff', diffLang],
  ['dockerfile', dockerfileLang],
  ['ini', iniLang],
  ['php', phpLang],
  ['ruby', rubyLang],
  ['powershell', powershellLang],
  ['makefile', makefileLang],
];
for (const [name, lang] of HIGHLIGHT_LANGUAGES) {
  hljs.registerLanguage(name, lang);
}

/**
 * 注入 md-editor 全局扩展配置（模块级执行：先于任何编辑器实例挂载）。
 * md-editor 源码守卫为「instance 存在即跳过对应 unpkg script/link 的追加」，
 * 至此编辑器在离线/被墙环境具备全部能力（mermaid/katex/高亮/格式化/裁剪/全屏/echarts 图表）。
 *
 * echarts.parseOption 安全覆写：md-editor 默认实现用 new Function 兼容函数写法，
 * 触碰项目 Security Rules（禁止 eval/Function 处理用户输入）；此处改为严格 JSON.parse，
 * echarts 代码块仅接受纯 JSON 选项对象（含函数/注释的写法解析失败、保留原代码展示）。
 */
config({
  editorExtensions: {
    highlight: { instance: hljs },
    prettier: { prettierInstance: prettier, parserMarkdownInstance: prettierMarkdownPlugin },
    cropper: { instance: Cropper },
    screenfull: { instance: screenfull },
    mermaid: { instance: mermaid },
    katex: { instance: katex },
    echarts: {
      instance: echarts,
      parseOption: (code: string) => JSON.parse(code) as Record<string, unknown>,
    },
  },
});

/** 自动保存防抖时长（ms），与任务约定一致 */
const AUTOSAVE_DELAY_MS = 300;

/** 首启欢迎文档内容：覆盖标题/表格/代码块/mermaid 图/katex 公式/任务列表，打开即体验核心能力 */
const WELCOME_CONTENT = `# Markdown 工作台

欢迎使用 Markdown 工作台！内容**自动保存**在浏览器本地，刷新或关闭后不会丢失。

## 基础语法

支持 **粗体**、*斜体*、~~删除线~~、\`行内代码\`，以及 [链接](https://tools.baixuanz.cn)。

## 任务列表

- [x] 工具栏一键切换 分栏 / 仅编辑 / 仅预览
- [x] 多文档草稿箱，左侧随时切换
- [ ] 把这份文档改成你自己的内容

## 表格

| 能力 | 状态 |
| ---- | ---- |
| 图片粘贴 / 拖拽（base64 内联） | ✅ |
| mermaid 图表 | ✅ |
| 数学公式（KaTeX） | ✅ |

## 代码块

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## 数学公式

行内公式：$E = mc^2$

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## mermaid 图表

\`\`\`mermaid
graph LR
  A[编写 Markdown] --> B{选择视图}
  B -->|编辑| C[专注写作]
  B -->|分栏| D[边写边看]
  B -->|预览| E[阅读分享]
\`\`\`

> 提示：所有内容仅保存在浏览器 localStorage，不会上传到任何服务器。`;

/** 隐藏的工具栏项：github 是 md-editor 仓库外链，与独立工作台无关 */
const TOOLBARS_EXCLUDE: ToolbarNames[] = ['github'];

// 主题 store 的解构（Shell 同款）：ref 在模板中自动解包
const { mode: themeMode, current: resolvedTheme } = themeStore;

/** 文档清单镜像（listDocs 结果，供侧栏与标题渲染；排序由 doc-store 保证 updatedAt 降序） */
const docs = ref<MarkdownDoc[]>([]);
/** 当前活动文档 ID；初始化前为 null */
const activeId = ref<string | null>(null);
/** 当前活动文档正文（编辑器双向绑定源） */
const content = ref('');
/**
 * 侧栏开合。client:only 岛的 setup 仅在浏览器执行（无 SSR 水合不匹配风险），
 * 故可直接按视口宽度取初值：桌面展开、移动端收起。
 */
const sidebarOpen = ref(window.innerWidth >= 1024);
/** 导入用的隐藏文件选择框 */
const importInputRef = ref<HTMLInputElement | null>(null);
/** HTML 导出预览对话框开合（HTML 菜单项不再直接下载，先预览选主题） */
const htmlExportOpen = ref(false);

/**
 * 用户显式重命名的标题（id → 标题）。
 * doc-store.saveDoc 会按内容重推断标题，为让显式重命名在后续编辑中保持稳定，
 * 每次落盘后把显式值回写（renameDoc）。
 */
const customTitles = new Map<string, string>();
/** 自动保存定时器句柄（undefined 表示无挂起保存） */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** 最近一次落盘的内容快照：切换文档等引起的等值 watch 不触发无意义写入 */
let lastSavedContent = '';

/** 当前活动文档（顶栏标题渲染用） */
const activeDoc = computed(() => docs.value.find((d) => d.id === activeId.value) ?? null);

// ---- 生命周期与初始化 ----

onMounted(() => {
  // 独立页无 Layout 的首帧脚本之外的初始化入口，主题恢复必须由本岛承担
  themeStore.load();
  initDocs();
});

onBeforeUnmount(() => {
  flushPendingSave();
});

/**
 * 初始化文档清单：空存储时创建欢迎文档（打开即体验）；
 * 活动文档缺失（脏数据被重置等）时回退到最近一篇。
 */
function initDocs(): void {
  docs.value = listDocs();
  if (docs.value.length === 0) {
    createDoc(WELCOME_CONTENT);
    docs.value = listDocs();
  }
  activeId.value = docs.value[0]?.id ?? null;
  content.value = activeDoc.value?.content ?? '';
  lastSavedContent = content.value;
}

// ---- 自动保存 ----

// 内容变化 → 300ms 防抖落盘（输入停顿即保存，刷新/关闭后恢复）
watch(content, () => {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    persistActive();
  }, AUTOSAVE_DELAY_MS);
});

/**
 * 将当前活动文档内容写入 doc-store，并在保存后回写显式重命名的标题
 * （doc-store 语义：saveDoc 会按内容重推断标题，显式命名需 UI 层保全）。
 */
function persistActive(): void {
  const id = activeId.value;
  if (!id || content.value === lastSavedContent) return;
  const saved = saveDoc(id, content.value);
  if (!saved) return;
  lastSavedContent = saved.content;
  const customTitle = customTitles.get(id);
  if (customTitle !== undefined && customTitle !== saved.title) {
    renameDoc(id, customTitle);
  }
  docs.value = listDocs();
}

/** 存在挂起的自动保存时立即落盘（切换文档 / 卸载前调用，防丢最后 300ms 输入） */
function flushPendingSave(): void {
  if (saveTimer === undefined) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  persistActive();
}

// ---- 文档操作（侧栏与顶栏入口共用） ----

/**
 * 切换活动文档：先落盘当前内容，再载入目标文档；移动端选中后收起侧栏。
 * @param id 目标文档 ID
 */
function handleSelect(id: string): void {
  if (id === activeId.value) return;
  flushPendingSave();
  activeId.value = id;
  content.value = docs.value.find((d) => d.id === id)?.content ?? '';
  lastSavedContent = content.value;
  if (window.innerWidth < 1024) sidebarOpen.value = false;
}

/** 新建空白文档并切换为活动文档 */
function handleCreate(): void {
  flushPendingSave();
  const doc = createDoc();
  docs.value = listDocs();
  activeId.value = doc.id;
  content.value = doc.content;
  lastSavedContent = content.value;
}

/**
 * 重命名文档：显式标题记入 customTitles，此后自动保存不再让内容推断覆盖它。
 * @param id 目标文档 ID
 * @param title 新标题
 */
function handleRename(id: string, title: string): void {
  const saved = renameDoc(id, title);
  if (!saved) return;
  customTitles.set(id, saved.title);
  docs.value = listDocs();
}

/**
 * 删除文档（侧栏确认后调用）：删除活动文档时回退到最近一篇，全部删空则重建欢迎文档。
 * @param id 目标文档 ID
 */
function handleRemove(id: string): void {
  flushPendingSave();
  if (!deleteDoc(id)) return;
  customTitles.delete(id);
  docs.value = listDocs();
  if (docs.value.length === 0) {
    const welcome = createDoc(WELCOME_CONTENT);
    docs.value = listDocs();
    activeId.value = welcome.id;
    content.value = welcome.content;
    lastSavedContent = content.value;
    return;
  }
  if (id === activeId.value) {
    const next = docs.value[0];
    activeId.value = next.id;
    content.value = next.content;
    lastSavedContent = content.value;
  }
}

/**
 * 顶栏标题输入提交（change = Enter 或失焦且值变更）。
 * 提交后把 doc-store 规范化（trim / 空值回退）的标题回写到输入框。
 * @param event 输入框 change 事件
 */
function handleTitleInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!activeId.value) return;
  handleRename(activeId.value, input.value);
  input.value = docs.value.find((d) => d.id === activeId.value)?.title ?? '';
}

// ---- 导入 / 导出 ----

/** 打开系统文件选择框（accept 限定 .md / .markdown） */
function openImportPicker(): void {
  importInputRef.value?.click();
}

/**
 * 导入所选 .md 文件：FileReader 读文本写入当前文档（标题随内容自动更新）。
 * @param event 文件选择框 change 事件
 */
function handleImportFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 重置以允许连续导入同名文件
  if (!file) return;
  if (!/\.(md|markdown)$/i.test(file.name)) {
    toastStore.error('仅支持导入 .md 或 .markdown 文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      toastStore.error('文件读取失败，请重试');
      return;
    }
    content.value = reader.result;
    toastStore.show(`已导入「${file.name}」到当前文档`);
  };
  reader.onerror = () => toastStore.error('文件读取失败，请重试');
  reader.readAsText(file);
}

/**
 * 从当前文档标题推导下载文件名：去除文件系统非法字符，空标题回退 document。
 * @param extension 文件扩展名（不含点）
 * @returns 形如「标题.md」的文件名
 */
function buildExportFilename(extension: string): string {
  const base = (activeDoc.value?.title ?? '').replace(/[\\/:*?"<>|]/g, '-').trim();
  return `${base === '' ? 'document' : base}.${extension}`;
}

/** 导出 .md 文件 */
function handleExportMd(): void {
  try {
    exportMarkdown(content.value, buildExportFilename('md'));
    toastStore.show('已导出 Markdown 文件');
  } catch {
    toastStore.error('导出失败，请重试');
  }
}

/**
 * 打开 HTML 导出预览对话框（预览选主题后经对话框内按钮下载）。
 * 延迟到导出菜单卸载完成后再挂载 Dialog：reka-ui 菜单收起时的焦点还原
 * 会把同 tick 挂载的 Dialog 判定为外部交互、秒开秒关（实测挂载 20ms 内即被移除）。
 */
function handleExportHtml(): void {
  window.setTimeout(() => {
    htmlExportOpen.value = true;
  }, 100);
}

/**
 * 导出 PDF：把预览区元素交给 exportPdf 克隆到打印宿主输出（分栏模式的预览栏与
 * 内置「仅预览」视图均有 .md-editor-preview）。用户通过内置工具栏关闭预览后无预览 DOM，予以提示。
 */
function handleExportPdf(): void {
  const preview = document.querySelector<HTMLElement>('.md-editor-preview');
  if (!preview) {
    toastStore.error('当前无预览内容，请先通过工具栏恢复预览再导出 PDF');
    return;
  }
  try {
    exportPdf(preview);
  } catch {
    toastStore.error('导出失败，请重试');
  }
}

// ---- 编辑器回调 ----

/**
 * md-editor 图片上传回调（粘贴 / 拖拽触发）：全部文件用 FileReader 转 base64 data URL
 * 后经 callback 交还编辑器内联插入（无上传后端，纯浏览器端）。
 * @param files 粘贴 / 拖入的图片文件列表
 * @param callback md-editor 回调：接收 url 数组（数组形式）后插入正文
 */
const handleUploadImg: UploadImgEvent = (files, callback: UploadImgCallBack): void => {
  if (files.length === 0) return;
  const dataUrls: string[] = [];
  let pending = files.length;
  let failed = 0;

  /** 全部文件读取结束后统一回调并提示 */
  const settle = (): void => {
    if (dataUrls.length > 0) callback(dataUrls);
    if (failed > 0) toastStore.error(`${failed} 张图片读取失败`);
    else toastStore.show(`已内联 ${dataUrls.length} 张图片`);
  };

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') dataUrls.push(reader.result);
      else failed += 1;
      pending -= 1;
      if (pending === 0) settle();
    };
    reader.onerror = () => {
      failed += 1;
      pending -= 1;
      if (pending === 0) settle();
    };
    reader.readAsDataURL(file);
  }
};

/** 编辑器内 Ctrl/Cmd+S 触发：立即落盘并提示 */
function handleEditorSave(): void {
  flushPendingSave();
  toastStore.show('已保存到本地草稿');
}
</script>

<template>
  <div class="h-dvh flex flex-col overflow-hidden bg-background text-foreground font-sans">
    <!-- 顶栏：文档操作 + 标题 + 视图切换 + 主题切换 -->
    <header
      class="flex flex-wrap items-center gap-1.5 px-3 py-1.5 min-h-12 shrink-0 border-b border-border bg-card"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="切换文档列表"
        :aria-expanded="sidebarOpen"
        title="文档列表"
        @click="sidebarOpen = !sidebarOpen"
      >
        <PanelLeft class="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="新建文档" title="新建文档" @click="handleCreate">
        <FilePlus2 class="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="导入 .md 文件" title="导入 .md 文件" @click="openImportPicker">
        <FileUp class="h-5 w-5" />
      </Button>

      <!-- 导出下拉 -->
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :class="buttonVariants({ variant: 'ghost', size: 'icon' })"
          aria-label="导出"
          title="导出"
        >
          <Download class="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent :side-offset="4" align="start">
            <DropdownMenuItem class="cursor-pointer" @select="handleExportMd">Markdown（.md）</DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer" @select="handleExportHtml">HTML（.html）</DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer" @select="handleExportPdf">PDF（打印）</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <!-- 当前文档标题：可编辑（Enter / 失焦提交） -->
      <input
        :key="activeId ?? 'none'"
        type="text"
        :value="activeDoc?.title ?? ''"
        :disabled="!activeDoc"
        class="flex-1 min-w-16 h-8 px-2 rounded-sm bg-transparent text-sm font-medium text-foreground border border-transparent hover:border-border focus:border-primary focus:outline-none disabled:opacity-50"
        aria-label="当前文档标题"
        placeholder="未命名文档"
        @change="handleTitleInput"
      />

      <!-- 视图切换由 md-editor 内置工具栏提供（preview / previewOnly），不再自建分段控件 -->

      <!-- 主题三态切换（复用 themeStore，交互与 Shell 同款） -->
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :class="buttonVariants({ variant: 'ghost', size: 'icon' })"
          :aria-label="`当前主题：${themeMode === 'system' ? '跟随系统' : resolvedTheme === 'dark' ? '暗色' : '浅色'}，点击切换`"
          title="主题"
        >
          <Monitor v-if="themeMode === 'system'" class="h-5 w-5" />
          <Moon v-else-if="resolvedTheme === 'dark'" class="h-5 w-5" />
          <Sun v-else class="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent :side-offset="4" align="end">
            <DropdownMenuItem class="cursor-pointer" @select="themeStore.apply('light')">
              <Sun class="h-4 w-4" /> 浅色
              <Check v-if="themeMode === 'light'" class="ml-auto h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer" @select="themeStore.apply('dark')">
              <Moon class="h-4 w-4" /> 暗色
              <Check v-if="themeMode === 'dark'" class="ml-auto h-4 w-4" />
            </DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer" @select="themeStore.apply('system')">
              <Monitor class="h-4 w-4" /> 跟随系统
              <Check v-if="themeMode === 'system'" class="ml-auto h-4 w-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>

      <!-- 隐藏的导入文件选择框 -->
      <input
        ref="importInputRef"
        type="file"
        accept=".md,.markdown"
        class="hidden"
        aria-hidden="true"
        tabindex="-1"
        @change="handleImportFile"
      />
    </header>

    <!-- 主体行：文档侧栏 + 编辑器 -->
    <div class="flex-1 flex min-h-0">
      <!-- 移动端侧栏遮罩 -->
      <div
        v-if="sidebarOpen"
        class="lg:hidden fixed inset-0 z-30 bg-black/40"
        aria-hidden="true"
        @click="sidebarOpen = false"
      ></div>

      <!-- 文档侧栏：桌面静态列，移动端 fixed 抽屉 -->
      <aside
        v-show="sidebarOpen"
        class="w-60 shrink-0 border-r border-border bg-card min-h-0 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-72 max-lg:shadow-lg"
      >
        <DocumentSidebar
          :docs="docs"
          :active-id="activeId"
          @select="handleSelect"
          @create="handleCreate"
          @rename="handleRename"
          @remove="handleRemove"
        />
      </aside>

      <main class="flex-1 min-w-0 min-h-0">
        <!-- md-editor 完整编辑器：分栏为默认形态，仅编辑/仅预览经其内置工具栏切换 -->
        <MdEditor
          v-model="content"
          :theme="resolvedTheme"
          language="zh-CN"
          auto-focus
          placeholder="开始编写 Markdown…"
          :toolbars-exclude="TOOLBARS_EXCLUDE"
          class="md-workstation-editor"
          @onUploadImg="handleUploadImg"
          @onSave="handleEditorSave"
        />
      </main>
    </div>

    <!-- 独立页无 Shell，Toaster 由本岛自含挂载 -->
    <Toaster />

    <!-- HTML 导出预览：主题选择 + 所见即所得预览 + 下载 -->
    <HtmlExportDialog
      v-model:open="htmlExportOpen"
      :markdown="content"
      :title="activeDoc?.title ?? ''"
      :filename="buildExportFilename('html')"
    />
  </div>
</template>

<style>
/* md-editor 根元素默认 500px 高，工作台中需撑满主体行剩余空间 */
.md-workstation-editor {
  height: 100%;
}

/*
 * 暗色代码高亮（hljs codeTheme 默认 atom）：
 * instance 注入后 md-editor 不再追加 CDN 主题样式，浅色基底由 atom-one-light.css 全局提供，
 * 暗色取 atom-one-dark 令牌色，以 .dark 作用域覆盖（页面 <html class="dark"> 为祖先）。
 */
.dark .hljs {
  color: #abb2bf;
  background: #282c34;
}
.dark .hljs-comment,
.dark .hljs-quote {
  color: #5c6370;
  font-style: italic;
}
.dark .hljs-doctag,
.dark .hljs-keyword,
.dark .hljs-formula {
  color: #c678dd;
}
.dark .hljs-section,
.dark .hljs-name,
.dark .hljs-selector-tag,
.dark .hljs-deletion,
.dark .hljs-subst {
  color: #e06c75;
}
.dark .hljs-literal {
  color: #56b6c2;
}
.dark .hljs-string,
.dark .hljs-regexp,
.dark .hljs-addition,
.dark .hljs-attribute,
.dark .hljs-meta .hljs-string {
  color: #98c379;
}
.dark .hljs-attr,
.dark .hljs-variable,
.dark .hljs-template-variable,
.dark .hljs-type,
.dark .hljs-selector-class,
.dark .hljs-selector-attr,
.dark .hljs-selector-pseudo,
.dark .hljs-number {
  color: #d19a66;
}
.dark .hljs-symbol,
.dark .hljs-bullet,
.dark .hljs-link,
.dark .hljs-meta,
.dark .hljs-selector-id,
.dark .hljs-title {
  color: #61aeee;
}
.dark .hljs-built_in,
.dark .hljs-title.class_,
.dark .hljs-class .hljs-title {
  color: #e6c07b;
}
.dark .hljs-emphasis {
  font-style: italic;
}
.dark .hljs-strong {
  font-weight: bold;
}
.dark .hljs-link {
  text-decoration: underline;
}

/*
 * PDF 导出打印样式：页面交给 markdown-export.exportPdf 动态挂载的打印宿主
 * （.md-print-host，含预览区克隆，挂 md-editor 类命中排版主题变量作用域）。
 * body 直下除宿主外全部退场（含 reka-ui portal 的菜单/toast 残影，规避关闭动画与
 * window.print 的时序竞态）；宿主只中和 .md-editor 根的盒模型约束（500px 高 /
 * 边框 / overflow 裁剪），让克隆内容以正常文档流跨页分页；超宽代码块 pre-wrap
 * 折行避免被页宽裁切，标题不与后续内容分家，代码块/表格尽量不跨页截断。
 * 屏幕态 display:none 是 afterprint 未触发时（旧 Safari）的兜底隐藏。
 */
.md-print-host {
  display: none;
}

@media print {
  body > :not(.md-print-host) {
    display: none !important;
  }
  .md-print-host {
    display: block;
    height: auto;
    border: none;
    background: none;
    overflow: visible;
  }
  .md-print-host .md-editor-preview {
    padding: 2rem;
  }
  /* 代码块头部的窗口装饰点/语言标签/复制按钮是屏幕交互件，打印剔除 */
  .md-print-host .md-editor-code-head {
    display: none;
  }
  /* 预览主题的代码块是浅字深底（浅色模式亦然），打印不输出背景时浅字会贴白纸，强制深字 */
  .md-print-host .md-editor-code pre,
  .md-print-host .md-editor-code pre code {
    color: #383a42 !important;
    background: transparent !important;
  }
  .md-print-host pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .md-print-host h1,
  .md-print-host h2,
  .md-print-host h3 {
    break-after: avoid;
  }
  .md-print-host pre,
  .md-print-host table {
    break-inside: avoid;
  }
}
</style>
