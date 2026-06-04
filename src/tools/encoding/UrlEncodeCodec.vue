<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import DisclosureSection from '../../components/ui/DisclosureSection.vue';
import { encodeUrl, decodeUrl, parseUrl, type UrlParseResult } from '../../utils/encoding/url-codec';

const input = ref('');

const encodeComponentResult = ref('');
const encodeFullResult = ref('');
const decodeComponentResult = ref('');
const decodeFullResult = ref('');
const decodeComponentError = ref('');
const decodeFullError = ref('');

const urlParsed = ref<UrlParseResult | null>(null);

function execute() {
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
  decodeComponentError.value = '';
  decodeFullError.value = '';

  if (!input.value.trim()) {
    return;
  }

  const encResult = encodeUrl(input.value);
  encodeComponentResult.value = encResult.component.value;
  encodeFullResult.value = encResult.full.value;

  const decResult = decodeUrl(input.value);
  decodeComponentResult.value = decResult.component.value;
  decodeComponentError.value = decResult.component.error ?? '';
  decodeFullResult.value = decResult.full.value;
  decodeFullError.value = decResult.full.error ?? '';
}

watch(input, () => {
  execute();
  if (/^https?:\/\//.test(input.value) || /:\/\//.test(input.value)) {
    urlParsed.value = parseUrl(input.value);
  } else {
    urlParsed.value = null;
  }
});

function handleExample() {
  input.value = 'https://example.com/search?q=你好世界&lang=zh-CN';
}

function handleClear() {
  input.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
  decodeComponentError.value = '';
  decodeFullError.value = '';
  urlParsed.value = null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const diffResult = computed(() => {
  const comp = encodeComponentResult.value;
  const full = encodeFullResult.value;
  if (!comp || !full) return null;

  let ci = 0;
  let fi = 0;
  const compParts: Array<{ text: string; diff: boolean }> = [];
  const fullParts: Array<{ text: string; diff: boolean }> = [];

  while (ci < comp.length && fi < full.length) {
    if (comp[ci] === full[fi]) {
      const cs = ci;
      const fs = fi;
      while (ci < comp.length && fi < full.length && comp[ci] === full[fi]) {
        ci++;
        fi++;
      }
      compParts.push({ text: comp.slice(cs, ci), diff: false });
      fullParts.push({ text: full.slice(fs, fi), diff: false });
    } else {
      const cs = ci;
      const fs = fi;
      if (comp[ci] === '%') {
        let count = 0;
        while (ci < comp.length && comp[ci] === '%') {
          ci += 3;
          count++;
        }
        fi += count;
      } else if (full[fi] === '%') {
        let count = 0;
        while (fi < full.length && full[fi] === '%') {
          fi += 3;
          count++;
        }
        ci += count;
      } else {
        ci++;
        fi++;
      }
      compParts.push({ text: comp.slice(cs, ci), diff: true });
      fullParts.push({ text: full.slice(fs, fi), diff: true });
    }
  }

  if (ci < comp.length) compParts.push({ text: comp.slice(ci), diff: false });
  if (fi < full.length) fullParts.push({ text: full.slice(fi), diff: false });

  const hasDiff = compParts.some((p) => p.diff);
  if (!hasDiff) return null;

  const compHtml = compParts
    .map((p) =>
      p.diff
        ? `<span class="bg-amber-100 text-amber-800 rounded-sm px-0.5">${escapeHtml(p.text)}</span>`
        : escapeHtml(p.text),
    )
    .join('');
  const fullHtml = fullParts
    .map((p) =>
      p.diff
        ? `<span class="bg-green-100 text-green-800 rounded-sm px-0.5">${escapeHtml(p.text)}</span>`
        : escapeHtml(p.text),
    )
    .join('');

  return { compHtml, fullHtml };
});
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="URL 编解码"
      description="URL 编码与解码，实时展示编码和解码结果"
      @example="handleExample"
    />

    <div class="mb-4">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入</label>
      <textarea v-model="input" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="3" placeholder="输入文本或 URL，同时查看编码与解码结果"></textarea>
    </div>

    <div class="mb-4">
      <ClearButton @clear="handleClear" />
    </div>

    <!-- URL 解析 -->
    <DisclosureSection v-if="urlParsed" title="🔗 检测到 URL" class="mb-4">
      <div class="flex flex-col gap-2">
        <div class="flex items-start gap-2">
          <span class="text-[0.8125rem] text-muted shrink-0 w-20">协议</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ urlParsed.protocol }}</code>
          <CopyButton :text="urlParsed.protocol" label="复制" />
        </div>
        <div class="flex items-start gap-2">
          <span class="text-[0.8125rem] text-muted shrink-0 w-20">主机</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ urlParsed.host }}</code>
          <CopyButton :text="urlParsed.host" label="复制" />
        </div>
        <div v-if="urlParsed.port" class="flex items-start gap-2">
          <span class="text-[0.8125rem] text-muted shrink-0 w-20">端口</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ urlParsed.port }}</code>
          <CopyButton :text="urlParsed.port" label="复制" />
        </div>
        <div class="flex items-start gap-2">
          <span class="text-[0.8125rem] text-muted shrink-0 w-20">路径</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ urlParsed.pathname }}</code>
          <CopyButton :text="urlParsed.pathname" label="复制" />
        </div>
        <div v-if="urlParsed.searchParams.length > 0" class="flex items-start gap-2">
          <span class="text-[0.8125rem] text-muted shrink-0 w-20">查询参数</span>
          <div class="flex-1 flex flex-col gap-1">
            <div v-for="param in urlParsed.searchParams" :key="param.key" class="flex items-start gap-2">
              <code class="font-mono text-[0.8125rem] text-accent">{{ param.key }}</code>
              <span class="text-muted text-[0.8125rem]">=</span>
              <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ param.value }}</code>
              <CopyButton :text="`${param.key}=${param.value}`" label="复制" />
            </div>
          </div>
        </div>
        <div v-if="urlParsed.hash" class="flex items-start gap-2">
          <span class="text-[0.8125rem] text-muted shrink-0 w-20">哈希</span>
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ urlParsed.hash }}</code>
          <CopyButton :text="urlParsed.hash" label="复制" />
        </div>
      </div>
    </DisclosureSection>

    <!-- 编码结果 -->
    <div class="border border-border rounded-md p-4 bg-card mb-4">
      <div class="text-[0.875rem] font-semibold text-accent mb-3">编码结果</div>

      <div class="mb-3">
        <div class="flex items-baseline gap-2 mb-1.5">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">encodeURIComponent</span>
          <span class="text-[0.6875rem] text-muted">编码 :/?&amp;=# 等 URL 结构字符，适用于编码单个查询参数值</span>
        </div>
        <div class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ encodeComponentResult || '—' }}</code>
          <CopyButton v-if="encodeComponentResult" :text="encodeComponentResult" label="复制" />
        </div>
      </div>

      <div>
        <div class="flex items-baseline gap-2 mb-1.5">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">encodeURI</span>
          <span class="text-[0.6875rem] text-muted">保留 URL 结构字符（:/?&amp;=#），适用于编码完整 URL</span>
        </div>
        <div class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ encodeFullResult || '—' }}</code>
          <CopyButton v-if="encodeFullResult" :text="encodeFullResult" label="复制" />
        </div>
      </div>

      <DisclosureSection v-if="diffResult" title="差异对照">
        <div class="mb-2">
          <div class="flex items-start gap-2 mb-1.5">
            <span class="text-[0.6875rem] text-muted shrink-0 w-[7.5rem] pt-0.5">encodeURIComponent</span>
            <code class="flex-1 font-mono text-[0.8125rem] break-all" v-html="diffResult.compHtml"></code>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-[0.6875rem] text-muted shrink-0 w-[7.5rem] pt-0.5">encodeURI</span>
            <code class="flex-1 font-mono text-[0.8125rem] break-all" v-html="diffResult.fullHtml"></code>
          </div>
        </div>
        <div class="text-[0.6875rem] text-muted leading-relaxed">
          <span class="inline-block bg-amber-100 text-amber-800 rounded-sm px-1 mr-1">橙色</span>部分表示 encodeURIComponent 额外编码的字符，
          <span class="inline-block bg-green-100 text-green-800 rounded-sm px-1 mr-1">绿色</span>部分表示 encodeURI 保留的 URL 结构字符
        </div>
      </DisclosureSection>
    </div>

    <!-- 解码结果 -->
    <div class="border border-border rounded-md p-4 bg-card">
      <div class="text-[0.875rem] font-semibold text-accent mb-3">解码结果</div>

      <div class="mb-3">
        <div class="flex items-baseline gap-2 mb-1.5">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">decodeURIComponent</span>
          <span class="text-[0.6875rem] text-muted">组件级解码</span>
        </div>
        <div v-if="decodeComponentError" class="text-error text-[0.8125rem]">{{ decodeComponentError }}</div>
        <div v-else class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ decodeComponentResult || '—' }}</code>
          <CopyButton v-if="decodeComponentResult" :text="decodeComponentResult" label="复制" />
        </div>
      </div>

      <div>
        <div class="flex items-baseline gap-2 mb-1.5">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">decodeURI</span>
          <span class="text-[0.6875rem] text-muted">完整 URL 级解码</span>
        </div>
        <div v-if="decodeFullError" class="text-error text-[0.8125rem]">{{ decodeFullError }}</div>
        <div v-else class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ decodeFullResult || '—' }}</code>
          <CopyButton v-if="decodeFullResult" :text="decodeFullResult" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>
