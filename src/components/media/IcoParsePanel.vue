<script setup lang="ts">
/**
 * ICO 解析面板（IcoMaker 工具私有，模式 B「解析 ICO」）。
 *
 * 导入 .ico / .cur → parseIco 解析 ICONDIR 条目 → 列表展示（尺寸 / 色深 /
 * 内嵌类型 / 字节数）→ 每条目懒生成 PNG 预览并支持"提取为 PNG"下载。
 * PNG 条目直接封装；BMP 条目（旧版 Windows 图标）重建文件头还原独立 BMP 后
 * 经 Image + canvas 解码转 PNG。字节解析复用 utils/media/ico-parse。
 *
 * 资源约定：条目预览 object URL 在本组件创建，重新导入 / 卸载时统一 revoke。
 */
import { onUnmounted, ref } from 'vue';
import FileDropzone from '../ui/FileDropzone.vue';
import { formatBytes } from '../../utils/shared/format';
import {
  parseIco,
  icoEntryToPng,
  buildBmpFromIcoEntry,
  type IcoEntry,
} from '../../utils/media/ico-parse';

/** 列表行视图：解析条目 + 懒生成的 PNG 预览/提取产物 */
interface EntryView {
  /** 解析出的原始条目 */
  entry: IcoEntry;
  /** 提取 PNG 的 object URL（预览与下载共用），未生成为空串 */
  previewUrl: string;
  /** 提取出的 PNG blob，未生成为 null */
  pngBlob: Blob | null;
  /** 该条目预览是否生成中 */
  loading: boolean;
  /** 该条目提取失败的中文错误 */
  error: string;
}

const errorMsg = ref('');
/** 当前解析的文件名（结果区展示） */
const fileName = ref('');
/** 是否光标文件（.cur） */
const isCursor = ref(false);
const views = ref<EntryView[]>([]);
/** 解析代际令牌：重新导入时丢弃在途预览生成，防止写入过期状态 */
let parseToken = 0;

/** 文件大小上限 10MB（图标文件远小于此，防异常超大文件） */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 导入并解析 .ico / .cur 文件。
 * 解析成功后清空旧结果、生成新条目列表，并串行生成各条目预览。
 */
async function handleFile(file: File): Promise<void> {
  errorMsg.value = '';
  releaseViews();
  const token = ++parseToken;
  fileName.value = file.name;
  isCursor.value = false;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseIco(bytes);
    if (token !== parseToken) return;
    isCursor.value = parsed.type === 'cursor';
    views.value = parsed.entries.map((entry) => ({
      entry,
      previewUrl: '',
      pngBlob: null,
      loading: false,
      error: '',
    }));
    // 串行生成预览：条目数有限，串行足够且避免瞬间并发解码
    for (let i = 0; i < views.value.length; i++) {
      if (token !== parseToken) return;
      await ensurePreview(i, token);
    }
  } catch (e) {
    if (token !== parseToken) return;
    errorMsg.value = e instanceof Error ? e.message : 'ICO 解析失败，请重试';
    releaseViews();
  }
}

/**
 * 确保第 i 个条目的 PNG 预览已生成（幂等；失败信息写入该行视图）。
 * @param i 条目行索引
 * @param token 本次解析代际令牌，过代则丢弃产物（防 URL 泄漏）
 */
async function ensurePreview(i: number, token: number): Promise<void> {
  const view = views.value[i];
  if (!view || view.pngBlob || view.loading) return;
  view.loading = true;
  view.error = '';
  try {
    const png = await extractEntryPng(view.entry);
    if (token !== parseToken) return;
    view.pngBlob = png;
    view.previewUrl = URL.createObjectURL(png);
  } catch (e) {
    if (token !== parseToken) return;
    view.error = e instanceof Error ? e.message : '条目解码失败';
  } finally {
    view.loading = false;
  }
}

/**
 * 将条目提取为独立 PNG blob。
 *
 * - PNG 条目：直接封装（零解码）；
 * - BMP 条目：重建 BITMAPFILEHEADER 还原独立 BMP，经 Image 解码到 canvas
 *   后统一转 PNG 交付（浏览器/设计工具可直接使用）。
 *
 * @param entry 解析条目
 * @throws 文件头重建或解码失败时抛出中文错误
 */
async function extractEntryPng(entry: IcoEntry): Promise<Blob> {
  if (entry.format === 'png') return icoEntryToPng(entry);

  const bmpBlob = buildBmpFromIcoEntry(entry);
  const bmpUrl = URL.createObjectURL(bmpBlob);
  try {
    const image = await decodeImage(bmpUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
    ctx.drawImage(image, 0, 0);
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!png) throw new Error('BMP 条目转 PNG 失败，图像数据可能已损坏');
    return png;
  } finally {
    URL.revokeObjectURL(bmpUrl);
  }
}

/**
 * 加载图片 URL 为 HTMLImageElement。
 * @param url 图片 object URL
 */
function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('BMP 条目解码失败，图像数据可能已损坏'));
    image.src = url;
  });
}

/** 重新选择文件：释放结果回到空态 */
function reset(): void {
  parseToken++;
  releaseViews();
  errorMsg.value = '';
  fileName.value = '';
  isCursor.value = false;
}

/** 释放全部条目预览 object URL 并清空列表 */
function releaseViews(): void {
  for (const v of views.value) {
    if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
  }
  views.value = [];
}

/**
 * 提取下载：条目 PNG 命名为 {原文件名}-{宽}x{高}.png。
 * @param view 条目行视图
 */
function downloadPng(view: EntryView): void {
  if (!view.pngBlob) return;
  const base = fileName.value.replace(/\.[^.]+$/, '') || 'ico';
  const url = URL.createObjectURL(view.pngBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}-${view.entry.width}x${view.entry.height}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

onUnmounted(() => {
  parseToken++;
  releaseViews();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="errorMsg" class="text-[0.8125rem] text-error m-0" role="alert">{{ errorMsg }}</p>

    <!-- 导入 -->
    <FileDropzone
      v-if="views.length === 0"
      :model-value="null"
      accept=".ico,.cur,image/x-icon,image/vnd.microsoft.icon"
      :max-size="MAX_FILE_SIZE"
      @select="handleFile"
      @error="errorMsg = $event"
    >
      <div class="text-sm text-foreground">拖入 .ico / .cur 文件 / 点击选择</div>
      <div class="text-xs text-muted-foreground mt-1">解析内部条目并逐条提取为 PNG，单文件上限 10MB</div>
    </FileDropzone>

    <!-- 解析结果 -->
    <template v-else>
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm text-foreground truncate" :title="fileName">{{ fileName }}</div>
        <button
          type="button"
          class="shrink-0 bg-card text-foreground border border-border rounded-sm px-3 py-1.5 text-[0.8125rem] transition-[background-color] duration-150 hover:bg-accent"
          @click="reset"
        >重新选择文件</button>
      </div>
      <p v-if="isCursor" class="text-[0.8125rem] text-info m-0">
        该文件是光标文件（.cur），按 ICO 结构解析展示
      </p>

      <div class="flex flex-col gap-2">
        <div
          v-for="view in views"
          :key="view.entry.index"
          class="flex items-center gap-3 p-2 border border-border rounded-sm bg-card"
        >
          <!-- 条目缩略预览（棋盘格衬底显示透明区域） -->
          <div
            class="w-14 h-14 shrink-0 rounded-sm border border-border bg-card flex items-center justify-center overflow-hidden bg-[image:repeating-conic-gradient(var(--color-muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
          >
            <img
              v-if="view.previewUrl"
              :src="view.previewUrl"
              :alt="`条目 ${view.entry.index + 1}（${view.entry.width}×${view.entry.height}）预览`"
              class="max-w-full max-h-full object-contain"
            />
            <span v-else-if="view.loading" class="text-xs text-muted-foreground">解析中…</span>
            <span v-else class="text-xs text-error">失败</span>
          </div>

          <!-- 条目信息 -->
          <div class="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-muted-foreground">
            <span class="text-foreground">#{{ view.entry.index + 1 }}</span>
            <span class="tabular-nums">{{ view.entry.width }}×{{ view.entry.height }}</span>
            <span class="tabular-nums">{{ view.entry.bitCount }}bpp</span>
            <span>{{ view.entry.format === 'png' ? 'PNG' : 'BMP' }}</span>
            <span class="tabular-nums">{{ formatBytes(view.entry.bytes.length) }}</span>
            <span v-if="view.error" class="text-error font-sans">{{ view.error }}</span>
          </div>

          <button
            type="button"
            class="shrink-0 bg-card text-foreground border border-border rounded-sm px-3 py-1.5 text-[0.8125rem] transition-[background-color] duration-150 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!view.pngBlob"
            @click="downloadPng(view)"
          >提取 PNG</button>
        </div>
      </div>
    </template>
  </div>
</template>
