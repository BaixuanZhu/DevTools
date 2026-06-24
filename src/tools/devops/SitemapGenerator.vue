<script setup lang="ts">
/**
 * sitemap 生成器主组件。
 *
 * 左侧支持逐条添加与批量粘贴录入 URL，每条可设 lastmod/changefreq/priority；
 * 右侧实时输出标准 sitemap.xml（priority/changefreq 已被 Google 忽略的说明见页面 FAQ）。
 */
import { reactive, ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import { downloadTextFile } from '../../utils/shared/download';
import {
  generateSitemapXml,
  parseBulkUrls,
  type SitemapUrl,
  type ChangeFreq,
} from '../../utils/devops/sitemap-generator';
import { isValidHttpUrl } from '../../utils/devops/meta-generator';

/** 更新频率可选项 */
const changefreqOptions: { value: ChangeFreq | ''; label: string }[] = [
  { value: '', label: '不设置' },
  { value: 'always', label: 'always' },
  { value: 'hourly', label: 'hourly' },
  { value: 'daily', label: 'daily' },
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
  { value: 'yearly', label: 'yearly' },
  { value: 'never', label: 'never' },
];

/** 优先级可选项 */
const priorityOptions: { value: number | ''; label: string }[] = [
  { value: '', label: '不设置' },
  { value: 1, label: '1.0' },
  { value: 0.8, label: '0.8' },
  { value: 0.6, label: '0.6' },
  { value: 0.4, label: '0.4' },
  { value: 0.2, label: '0.2' },
];

/** 默认 URL 列表（id 用固定字面量避免 SSR/水合不匹配） */
const urls = reactive<SitemapUrl[]>([
  { id: 'u1', loc: 'https://example.com/', lastmod: '2026-06-24', changefreq: 'weekly', priority: 1 },
  { id: 'u2', loc: 'https://example.com/about', lastmod: '2026-06-20', changefreq: 'monthly', priority: 0.8 },
  { id: 'u3', loc: 'https://example.com/blog', lastmod: '2026-06-24', changefreq: 'daily', priority: 0.6 },
]);

/** 批量粘贴文本 */
const bulkText = ref('');

const sitemapXml = computed(() => generateSitemapXml({ urls }));

/** 新增 URL */
function addUrl(): void {
  urls.push({ id: crypto.randomUUID(), loc: 'https://', lastmod: '', changefreq: '', priority: '' });
}
/** 删除 URL */
function removeUrl(id: string): void {
  const idx = urls.findIndex((u) => u.id === id);
  if (idx !== -1) urls.splice(idx, 1);
}

/** 解析批量粘贴并追加 */
function handleBulkImport(): void {
  const parsed = parseBulkUrls(bulkText.value);
  const existing = new Set(urls.map((u) => u.loc));
  for (const loc of parsed) {
    if (!existing.has(loc)) {
      urls.push({ id: crypto.randomUUID(), loc, lastmod: '', changefreq: '', priority: '' });
      existing.add(loc);
    }
  }
  bulkText.value = '';
}

/** 某条 loc 的校验提示 */
function locHint(u: SitemapUrl): string {
  if (u.loc.trim() === '') return '';
  return isValidHttpUrl(u.loc) ? '' : '建议使用完整 URL（以 https:// 开头）';
}

function handleDownload(): void {
  downloadTextFile('sitemap.xml', sitemapXml.value, 'application/xml;charset=utf-8');
}

function handleClear(): void {
  urls.splice(0, urls.length);
  bulkText.value = '';
}
</script>

<template>
  <div>
    <ToolHeader
      title="sitemap 生成器"
      description="逐条或批量录入 URL，设置频率/优先级/修改时间，生成标准 sitemap.xml"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <!-- 输入表单 -->
      <template #input>
        <div class="bg-card border border-border rounded-lg p-6 space-y-6">
          <!-- 批量粘贴 -->
          <div class="border border-border rounded-md p-4 space-y-2">
            <h3 class="text-sm font-semibold text-text m-0">批量粘贴 URL</h3>
            <p class="text-[0.75rem] text-muted m-0">一行一个 URL，自动去重</p>
            <textarea
              v-model="bulkText"
              rows="4"
              class="w-full px-3 py-2 border border-border rounded-sm bg-card text-text text-sm resize-y box-border focus:outline-none focus:border-accent transition-[border-color] duration-150"
              placeholder="https://example.com/&#10;https://example.com/about"
            ></textarea>
            <button
              type="button"
              class="px-4 py-2 text-sm border border-border rounded-sm bg-card text-text cursor-pointer hover:bg-hover transition-[background-color] duration-150"
              @click="handleBulkImport"
            >解析并追加</button>
          </div>

          <!-- URL 列表 -->
          <div class="space-y-4">
            <div
              v-for="u in urls"
              :key="u.id"
              class="border border-border rounded-md p-4 space-y-3"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="u.loc"
                  type="text"
                  class="flex-1 px-3 py-2 border border-border rounded-sm bg-card text-text text-sm focus:outline-none focus:border-accent transition-[border-color] duration-150"
                  placeholder="https://example.com/page"
                />
                <button
                  type="button"
                  class="px-2 py-2 text-[0.8125rem] text-muted border border-border rounded-sm bg-card cursor-pointer hover:bg-hover transition-[background-color] duration-150"
                  @click="removeUrl(u.id)"
                >✕</button>
              </div>
              <p v-if="locHint(u)" class="text-[0.75rem] text-error m-0">{{ locHint(u) }}</p>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label class="block mb-1 text-[0.75rem] text-muted">最后修改 lastmod</label>
                  <input
                    v-model="u.lastmod"
                    type="date"
                    class="w-full px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] focus:outline-none focus:border-accent box-border"
                  />
                </div>
                <div>
                  <span class="block mb-1 text-[0.75rem] text-muted">频率 changefreq</span>
                  <SelectListbox v-model="u.changefreq" :options="changefreqOptions" class="w-full" />
                </div>
                <div>
                  <span class="block mb-1 text-[0.75rem] text-muted">优先级 priority</span>
                  <SelectListbox v-model="u.priority" :options="priorityOptions" class="w-full" />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="addUrl"
          >+ 添加 URL</button>

          <button
            type="button"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150"
            @click="handleClear"
          >清空</button>
        </div>
      </template>

      <!-- 输出区 -->
      <template #output>
        <CodePanel
          label="sitemap.xml"
          :copy-text="sitemapXml"
          show-copy
          show-download
          @download="handleDownload"
        >
          <pre class="w-full p-4 bg-card text-text font-mono text-sm overflow-auto whitespace-pre-wrap break-all">{{ sitemapXml }}</pre>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
