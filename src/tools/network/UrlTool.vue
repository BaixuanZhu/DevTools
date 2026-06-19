<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import {
  parseUrl,
  encodeUrl,
  decodeUrl,
  buildUrlFromParams,
  type UrlParsedParts,
  type UrlEncodeResult,
  type UrlDecodeResult,
} from '../../utils/network/url';

/** 默认示例 URL */
const DEFAULT_INPUT = 'https://example.com/search?q=你好世界&lang=zh-CN';

/** Primary 按钮 class */
const BTN_PRIMARY_CLASS =
  'px-4 py-2 border border-accent rounded-sm bg-accent text-white text-[0.8125rem] cursor-pointer transition-[opacity] duration-150 hover:opacity-90';

/** 次要按钮 class */
const BTN_SECONDARY_CLASS =
  'px-3 py-1.5 border border-border rounded-sm bg-card text-text text-[0.8125rem] cursor-pointer transition-[background-color,border-color] duration-150 hover:bg-hover hover:border-accent';

const input = ref(DEFAULT_INPUT);
const parsed = ref<UrlParsedParts | null>(parseUrl(DEFAULT_INPUT));
const params = ref<Array<{ key: string; value: string }>>(parsed.value?.params ?? []);
const parseError = ref('');
const encodeResult = ref<UrlEncodeResult | null>(null);
const decodeResult = ref<UrlDecodeResult | null>(null);

// 输入变化时自动解析
watch(input, (val) => {
  const trimmed = val.trim();
  if (!trimmed) {
    parsed.value = null;
    params.value = [];
    parseError.value = '';
    return;
  }
  const result = parseUrl(trimmed);
  if (result) {
    parsed.value = result;
    params.value = result.params.map((p) => ({ ...p }));
    parseError.value = '';
  } else {
    parsed.value = null;
    params.value = [];
    parseError.value = '无法解析为合法 URL，请检查协议和格式';
  }
});

/** 编码当前输入 */
function handleEncode() {
  if (!input.value.trim()) return;
  decodeResult.value = null;
  try {
    encodeResult.value = encodeUrl(input.value);
  } catch {
    encodeResult.value = null;
  }
}

/** 解码当前输入 */
function handleDecode() {
  if (!input.value.trim()) return;
  encodeResult.value = null;
  try {
    decodeResult.value = decodeUrl(input.value);
  } catch {
    decodeResult.value = null;
  }
}

/** 清空所有状态 */
function handleClear() {
  input.value = '';
  parsed.value = null;
  params.value = [];
  parseError.value = '';
  encodeResult.value = null;
  decodeResult.value = null;
}

/** 新增 query 参数 */
function addParam() {
  params.value.push({ key: '', value: '' });
}

/** 删除指定 query 参数 */
function removeParam(index: number) {
  params.value.splice(index, 1);
}

/** 将当前 query 参数表应用回输入 URL */
function applyParams() {
  if (!input.value.trim() || !parsed.value) return;
  input.value = buildUrlFromParams(input.value, params.value);
}
</script>

<template>
  <div class="w-full max-w-3xl">
    <ToolHeader
      title="URL 解析器"
      description="URL 编解码与结构化解析，支持 query 参数表格化编辑与一键重建 URL"
      :show-example="false"
    />

    <!-- 输入层 -->
    <div class="mb-4">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1.5">URL</label>
      <div class="flex items-start gap-3">
        <textarea
          v-model="input"
          rows="2"
          placeholder="输入 URL，如 https://example.com/search?q=test"
          class="flex-1 px-4 py-2.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 placeholder:font-sans outline-none transition-[border-color] duration-150 focus:border-accent resize-none"
        ></textarea>
        <ClearButton @clear="handleClear" />
      </div>
    </div>

    <!-- 编解码层 -->
    <div class="mb-5 p-4 border border-border rounded-sm bg-card">
      <div class="flex items-center gap-2 mb-3">
        <button type="button" :class="BTN_SECONDARY_CLASS" @click="handleEncode">编码</button>
        <button type="button" :class="BTN_SECONDARY_CLASS" @click="handleDecode">解码</button>
      </div>

      <div v-if="encodeResult" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">encodeURIComponent</span>
            <CopyButton :text="encodeResult.component.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ encodeResult.component.value }}</code>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">encodeURI</span>
            <CopyButton :text="encodeResult.full.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ encodeResult.full.value }}</code>
        </div>
      </div>

      <div v-if="decodeResult" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">decodeURIComponent</span>
            <CopyButton :text="decodeResult.component.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ decodeResult.component.value }}</code>
          <p v-if="decodeResult.component.error" class="text-error text-[0.75rem] m-0">{{ decodeResult.component.error }}</p>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">decodeURI</span>
            <CopyButton :text="decodeResult.full.value" size="sm" />
          </div>
          <code class="block px-3 py-2 bg-surface border border-border rounded-sm text-xs text-text font-mono break-all">{{ decodeResult.full.value }}</code>
          <p v-if="decodeResult.full.error" class="text-error text-[0.75rem] m-0">{{ decodeResult.full.error }}</p>
        </div>
      </div>
    </div>

    <!-- 结构化解析层 -->
    <div class="p-4 border border-border rounded-sm bg-card">
      <h3 class="text-[0.8125rem] text-muted font-medium mb-3">结构化解析</h3>

      <p v-if="parseError" class="text-error text-[0.8125rem] m-0 mb-3">{{ parseError }}</p>

      <div v-if="parsed" class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div
            v-for="item in [
              { label: 'Protocol', value: parsed.protocol },
              { label: 'Host', value: parsed.host },
              { label: 'Hostname', value: parsed.hostname },
              { label: 'Port', value: parsed.port || '-' },
              { label: 'Pathname', value: parsed.pathname },
              { label: 'Search', value: parsed.search || '-' },
              { label: 'Hash', value: parsed.hash || '-' },
            ]"
            :key="item.label"
            class="flex flex-col gap-1 px-3 py-2 border border-border rounded-sm bg-surface"
          >
            <span class="text-[0.6875rem] font-semibold text-muted uppercase tracking-wide">{{ item.label }}</span>
            <div class="flex items-center gap-2">
              <code class="text-xs text-text font-mono break-all flex-1">{{ item.value }}</code>
              <CopyButton v-if="item.value !== '-'" :text="item.value" size="sm" />
            </div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-[0.75rem] font-semibold text-muted uppercase tracking-wide">Query 参数</h4>
            <button type="button" :class="BTN_SECONDARY_CLASS" @click="addParam">+ 添加</button>
          </div>

          <div v-if="params.length === 0" class="text-[0.8125rem] text-muted">暂无 query 参数</div>

          <div v-else class="flex flex-col gap-2">
            <div v-for="(_, index) in params" :key="index" class="flex items-center gap-2">
              <input
                v-model="params[index].key"
                type="text"
                placeholder="key"
                class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 outline-none focus:border-accent"
              />
              <input
                v-model="params[index].value"
                type="text"
                placeholder="value"
                class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono placeholder:text-muted/60 outline-none focus:border-accent"
              />
              <button
                type="button"
                class="px-2 py-1.5 text-[0.75rem] rounded-sm border border-border bg-card text-error hover:bg-hover transition-colors"
                @click="removeParam(index)"
              >
                删除
              </button>
            </div>
          </div>

          <button
            v-if="params.length > 0"
            type="button"
            :class="[BTN_PRIMARY_CLASS, 'mt-3']"
            @click="applyParams"
          >
            应用至 URL
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
