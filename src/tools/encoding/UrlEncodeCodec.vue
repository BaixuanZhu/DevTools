<script setup lang="ts">
import { ref, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import { encodeUrl, decodeUrl } from '../../utils/encoding/url-codec';

type Mode = 'encode' | 'decode';

const mode = ref<Mode>('encode');
const input = ref('');

const encodeComponentResult = ref('');
const encodeFullResult = ref('');
const decodeComponentResult = ref('');
const decodeFullResult = ref('');
const decodeComponentError = ref('');
const decodeFullError = ref('');

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

  if (mode.value === 'encode') {
    const result = encodeUrl(input.value);
    encodeComponentResult.value = result.component.value;
    encodeFullResult.value = result.full.value;
  } else {
    const result = decodeUrl(input.value);
    decodeComponentResult.value = result.component.value;
    decodeComponentError.value = result.component.error ?? '';
    decodeFullResult.value = result.full.value;
    decodeFullError.value = result.full.error ?? '';
  }
}

watch(mode, () => {
  input.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
  decodeComponentError.value = '';
  decodeFullError.value = '';
});

watch(input, () => {
  execute();
});

function handleExample() {
  mode.value = 'encode';
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
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="URL 编解码"
      description="URL 编码与解码，支持组件级和完整 URL 编码"
      @example="handleExample"
    />

    <ModeTabGroup v-model="mode" :options="[{ key: 'encode', label: '编码' }, { key: 'decode', label: '解码' }]" />

    <div class="mb-4">
      <label class="field-label">输入</label>
      <textarea v-model="input" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="3" :placeholder="mode === 'encode' ? '输入要编码的文本或 URL' : '输入要解码的 percent-encoded 文本'" @input="execute"></textarea>
    </div>

    <div class="mb-4">
      <ClearButton @clear="handleClear" />
    </div>

    <div v-if="mode === 'encode' && (encodeComponentResult || encodeFullResult)" class="flex flex-col gap-4">
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">encodeURIComponent</span>
          <span class="text-[0.6875rem] text-muted">组件级，编码所有特殊字符</span>
        </div>
        <div class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ encodeComponentResult }}</code>
          <CopyButton :text="encodeComponentResult" label="复制" />
        </div>
      </div>
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">encodeURI</span>
          <span class="text-[0.6875rem] text-muted">完整 URL 级，保留 URL 结构字符（: / ? & = #）</span>
        </div>
        <div class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ encodeFullResult }}</code>
          <CopyButton :text="encodeFullResult" label="复制" />
        </div>
      </div>
    </div>

    <div v-if="mode === 'decode' && (decodeComponentResult || decodeFullResult || decodeComponentError || decodeFullError)" class="flex flex-col gap-4">
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">decodeURIComponent</span>
          <span class="text-[0.6875rem] text-muted">组件级解码</span>
        </div>
        <div v-if="decodeComponentError" class="text-error text-[0.8125rem]">{{ decodeComponentError }}</div>
        <div v-else class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ decodeComponentResult }}</code>
          <CopyButton :text="decodeComponentResult" label="复制" />
        </div>
      </div>
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">decodeURI</span>
          <span class="text-[0.6875rem] text-muted">完整 URL 级解码</span>
        </div>
        <div v-if="decodeFullError" class="text-error text-[0.8125rem]">{{ decodeFullError }}</div>
        <div v-else class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ decodeFullResult }}</code>
          <CopyButton :text="decodeFullResult" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>
