<script setup lang="ts">
/**
 * URL 编解码工具组件
 * 提供 encodeURIComponent / encodeURI 编码与对应解码功能，
 * 并在检测到 URL（明文或编码后）时实时展示 URL 解析结果。
 */
import { ref, computed, watch, onMounted } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { encodeUrl, decodeUrl, parseUrl, type UrlParseResult } from '../../utils/encoding/url-codec';

type Action = 'encode' | 'decode';

/** 默认示例数据 */
const DEFAULT_INPUT = 'https://example.com/search?q=你好世界&lang=zh-CN';

const input = ref(DEFAULT_INPUT);
const currentAction = ref<Action | null>('encode');

const encodeComponentResult = ref('');
const encodeFullResult = ref('');
const decodeComponentResult = ref('');
const decodeFullResult = ref('');
const decodeComponentError = ref('');
const decodeFullError = ref('');

const urlParsed = ref<UrlParseResult | null>(null);

/** 执行编码操作 */
function executeEncode() {
  const result = encodeUrl(input.value);
  encodeComponentResult.value = result.component.value;
  encodeFullResult.value = result.full.value;
}

/** 执行解码操作 */
function executeDecode() {
  const result = decodeUrl(input.value);
  decodeComponentResult.value = result.component.value;
  decodeComponentError.value = result.component.error ?? '';
  decodeFullResult.value = result.full.value;
  decodeFullError.value = result.full.error ?? '';
}

/** 点击编码按钮 */
function handleEncode() {
  if (!input.value.trim()) return;
  currentAction.value = 'encode';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
  decodeComponentError.value = '';
  decodeFullError.value = '';
  executeEncode();
}

/** 点击解码按钮 */
function handleDecode() {
  if (!input.value.trim()) return;
  currentAction.value = 'decode';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  executeDecode();
}

/** 输入变化时重新执行当前操作并检测 URL */
watch(input, () => {
  if (currentAction.value === 'encode') {
    executeEncode();
  } else if (currentAction.value === 'decode') {
    executeDecode();
  }
  urlParsed.value = tryParseUrl(input.value);
});

/** 组件挂载时执行默认编码并检测 URL */
onMounted(() => {
  executeEncode();
  urlParsed.value = tryParseUrl(input.value);
});

/** 尝试将输入解析为 URL，支持明文和编码后的 URL */
function tryParseUrl(text: string): UrlParseResult | null {
  if (!text.trim()) return null;
  // 1. 直接尝试解析明文 URL
  if (/^https?:\/\//.test(text)) {
    return parseUrl(text);
  }
  // 2. 尝试解码后再解析（处理编码后的 URL）
  try {
    const decoded = decodeURIComponent(text);
    if (/^https?:\/\//.test(decoded)) {
      return parseUrl(decoded);
    }
  } catch { /* 解码失败，忽略 */ }
  return null;
}

function handleClear() {
  input.value = '';
  currentAction.value = null;
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

/** 差异对照 HTML（仅当两种编码结果不同时才有值） */
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
  <div>
    <ToolHeader
      title="URL 编解码"
      description="URL 编码与解码，实时展示编码和解码结果"
      :showExample="false"
    />

    <ResponsiveWorkspace mode="horizontal">
      <template #input>
        <!-- 输入区 -->
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入</label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="4"
            placeholder="输入文本或 URL"
          ></textarea>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2 items-center mb-4">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!input.trim()"
            @click="handleEncode"
          >编码</button>
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!input.trim()"
            @click="handleDecode"
          >解码</button>
          <ClearButton @clear="handleClear" />
        </div>

        <!-- URL 解析（常驻，独立于编码/解码操作） -->
        <div v-if="urlParsed" class="border border-border rounded-md p-4 bg-card">
          <div class="text-[0.875rem] font-semibold text-accent mb-3">URL 解析</div>
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
        </div>
      </template>

      <template #output>
        <!-- 编码结果 -->
        <template v-if="currentAction === 'encode'">
          <div class="border border-border rounded-md p-4 bg-card">
            <div class="text-[0.875rem] font-semibold text-accent mb-3">编码结果</div>

            <div class="mb-3">
              <div class="flex items-baseline gap-2 mb-1.5">
                <span class="text-[0.8125rem] font-semibold text-accent font-mono">encodeURIComponent</span>
                <span class="text-[0.6875rem] text-muted">编码 :/?&amp;=# 等 URL 结构字符，适用于编码单个查询参数值</span>
              </div>
              <div class="grid grid-cols-[1fr_auto] gap-2 items-start">
                <code class="font-mono text-[0.8125rem] break-all text-text min-w-0 bg-hover p-2 rounded-sm">{{ encodeComponentResult || '—' }}</code>
                <CopyButton v-if="encodeComponentResult" :text="encodeComponentResult" label="复制" class="shrink-0" />
              </div>
            </div>

            <div class="mb-3">
              <div class="flex items-baseline gap-2 mb-1.5">
                <span class="text-[0.8125rem] font-semibold text-accent font-mono">encodeURI</span>
                <span class="text-[0.6875rem] text-muted">保留 URL 结构字符（:/?&amp;=#），适用于编码完整 URL</span>
              </div>
              <div class="grid grid-cols-[1fr_auto] gap-2 items-start">
                <code class="font-mono text-[0.8125rem] break-all text-text min-w-0 bg-hover p-2 rounded-sm">{{ encodeFullResult || '—' }}</code>
                <CopyButton v-if="encodeFullResult" :text="encodeFullResult" label="复制" class="shrink-0" />
              </div>
            </div>

            <!-- 差异对照（仅当两种编码不同时显示） -->
            <div v-if="diffResult" class="border-t border-border pt-3 mt-3">
              <div class="text-[0.8125rem] font-semibold text-accent mb-2">差异对照</div>
              <div class="grid grid-cols-[auto_1fr] gap-2 items-start mb-1.5">
                <span class="text-[0.6875rem] text-muted shrink-0 w-[7.5rem] pt-0.5">encodeURIComponent</span>
                <code class="font-mono text-[0.8125rem] break-all min-w-0" v-html="diffResult.compHtml"></code>
              </div>
              <div class="grid grid-cols-[auto_1fr] gap-2 items-start mb-2">
                <span class="text-[0.6875rem] text-muted shrink-0 w-[7.5rem] pt-0.5">encodeURI</span>
                <code class="font-mono text-[0.8125rem] break-all min-w-0" v-html="diffResult.fullHtml"></code>
              </div>
              <div class="text-[0.6875rem] text-muted leading-relaxed">
                <span class="inline-block bg-amber-100 text-amber-800 rounded-sm px-1 mr-1">橙色</span>部分表示 encodeURIComponent 额外编码的字符，
                <span class="inline-block bg-green-100 text-green-800 rounded-sm px-1 mr-1">绿色</span>部分表示 encodeURI 保留的 URL 结构字符
              </div>
            </div>
          </div>
        </template>

        <!-- 解码结果 -->
        <template v-if="currentAction === 'decode'">
          <div class="border border-border rounded-md p-4 bg-card">
            <div class="text-[0.875rem] font-semibold text-accent mb-3">解码结果</div>

            <div class="mb-3">
              <div class="flex items-baseline gap-2 mb-1.5">
                <span class="text-[0.8125rem] font-semibold text-accent font-mono">decodeURIComponent</span>
                <span class="text-[0.6875rem] text-muted">组件级解码</span>
              </div>
              <div v-if="decodeComponentError" class="text-error text-[0.8125rem]">{{ decodeComponentError }}</div>
              <div v-else class="grid grid-cols-[1fr_auto] gap-2 items-start">
                <code class="font-mono text-[0.8125rem] break-all text-text min-w-0 bg-hover p-2 rounded-sm">{{ decodeComponentResult || '—' }}</code>
                <CopyButton v-if="decodeComponentResult" :text="decodeComponentResult" label="复制" class="shrink-0" />
              </div>
            </div>

            <div>
              <div class="flex items-baseline gap-2 mb-1.5">
                <span class="text-[0.8125rem] font-semibold text-accent font-mono">decodeURI</span>
                <span class="text-[0.6875rem] text-muted">完整 URL 级解码</span>
              </div>
              <div v-if="decodeFullError" class="text-error text-[0.8125rem]">{{ decodeFullError }}</div>
              <div v-else class="grid grid-cols-[1fr_auto] gap-2 items-start">
                <code class="font-mono text-[0.8125rem] break-all text-text min-w-0 bg-hover p-2 rounded-sm">{{ decodeFullResult || '—' }}</code>
                <CopyButton v-if="decodeFullResult" :text="decodeFullResult" label="复制" class="shrink-0" />
              </div>
            </div>
          </div>
        </template>

        <!-- 空状态 -->
        <div v-if="!currentAction" class="border border-border rounded-md p-4 bg-card">
          <p class="text-muted text-[0.8125rem] m-0 text-center">点击「编码」或「解码」按钮查看结果</p>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
