<script setup lang="ts">
import { ref } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { encodeUrl, decodeUrl } from '../../utils/encoding/url-codec';

type Mode = 'encode' | 'decode';

const mode = ref<Mode>('encode');
const input = ref('');
const errorMsg = ref('');

const encodeComponentResult = ref('');
const encodeFullResult = ref('');
const decodeComponentResult = ref('');
const decodeFullResult = ref('');

function execute() {
  errorMsg.value = '';
  if (!input.value.trim()) {
    errorMsg.value = mode.value === 'encode' ? '请输入要编码的文本' : '请输入要解码的文本';
    return;
  }

  if (mode.value === 'encode') {
    const result = encodeUrl(input.value);
    encodeComponentResult.value = result.component;
    encodeFullResult.value = result.full;
    decodeComponentResult.value = '';
    decodeFullResult.value = '';
  } else {
    const result = decodeUrl(input.value);
    decodeComponentResult.value = result.component;
    decodeFullResult.value = result.full;
    encodeComponentResult.value = '';
    encodeFullResult.value = '';
    if (result.error) errorMsg.value = result.error;
  }
}

function switchMode(newMode: Mode) {
  mode.value = newMode;
  errorMsg.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
}

function handleExample() {
  mode.value = 'encode';
  input.value = 'https://example.com/search?q=你好世界&lang=zh-CN';
  execute();
}

function handleClear() {
  input.value = '';
  errorMsg.value = '';
  encodeComponentResult.value = '';
  encodeFullResult.value = '';
  decodeComponentResult.value = '';
  decodeFullResult.value = '';
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="URL 编解码"
      description="URL 编码与解码，支持组件级和完整 URL 编码"
      @example="handleExample"
    />

    <div class="flex gap-1 mb-4">
      <button
        :class="['px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150', mode === 'encode' ? 'bg-accent text-white border-accent' : 'bg-card text-text border-border']"
        @click="switchMode('encode')"
      >编码</button>
      <button
        :class="['px-6 py-2 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150', mode === 'decode' ? 'bg-accent text-white border-accent' : 'bg-card text-text border-border']"
        @click="switchMode('decode')"
      >解码</button>
    </div>

    <div class="mb-4">
      <label class="field-label">输入</label>
      <textarea v-model="input" class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent" rows="3" :placeholder="mode === 'encode' ? '输入要编码的文本或 URL' : '输入要解码的 percent-encoded 文本'"></textarea>
    </div>

    <div class="flex gap-2 items-center mb-4">
      <button class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90" @click="execute">{{ mode === 'encode' ? '编码' : '解码' }}</button>
      <ClearButton @clear="handleClear" />
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <div v-if="encodeComponentResult || decodeComponentResult" class="flex flex-col gap-4">
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">{{ mode === 'encode' ? 'encodeURIComponent' : 'decodeURIComponent' }}</span>
          <span class="text-[0.6875rem] text-muted">组件级，编码/解码所有特殊字符</span>
        </div>
        <div class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ mode === 'encode' ? encodeComponentResult : decodeComponentResult }}</code>
          <CopyButton :text="mode === 'encode' ? encodeComponentResult : decodeComponentResult" label="复制" />
        </div>
      </div>
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-baseline gap-2 mb-2">
          <span class="text-[0.8125rem] font-semibold text-accent font-mono">{{ mode === 'encode' ? 'encodeURI' : 'decodeURI' }}</span>
          <span class="text-[0.6875rem] text-muted">完整 URL 级，保留 URL 结构字符（: / ? & = #）</span>
        </div>
        <div class="flex items-start gap-2">
          <code class="flex-1 font-mono text-[0.8125rem] break-all text-text">{{ mode === 'encode' ? encodeFullResult : decodeFullResult }}</code>
          <CopyButton :text="mode === 'encode' ? encodeFullResult : decodeFullResult" label="复制" />
        </div>
      </div>
    </div>
  </div>
</template>
