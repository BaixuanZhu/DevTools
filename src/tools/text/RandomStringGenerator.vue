<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import { generateRandomString, applyLetterCase, PRESET_CHARSETS } from '../../utils/text/random-string';
import type { CharsetPreset, LetterCase } from '../../utils/text/random-string';

const charsetMode = ref<'alphanumeric' | 'digits' | 'special' | 'custom'>('alphanumeric');
const customChars = ref('');
const length = ref(16);
const letterCase = ref<LetterCase>('none');
const count = ref(1);
const results = ref<string[]>([]);

const showLetterCase = computed(() => charsetMode.value !== 'digits');

const effectiveCharset = computed<CharsetPreset>(() => {
  if (charsetMode.value === 'custom') return `custom:${customChars.value}`;
  return charsetMode.value as CharsetPreset;
});

function generate() {
  const safeCount = Math.min(Math.max(count.value, 1), 1000);
  const safeLength = Math.min(Math.max(length.value, 1), 4096);
  const arr: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    arr.push(applyLetterCase(generateRandomString(safeLength, effectiveCharset.value), letterCase.value));
  }
  results.value = arr;
}

function showToast(message: string) {
  document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message } }));
}

async function copySingle(str: string) {
  try { await navigator.clipboard.writeText(str); showToast('已复制'); } catch {}
}

async function copyAll() {
  const text = results.value.join('\n');
  try { await navigator.clipboard.writeText(text); showToast('已复制'); } catch {}
}

function onCharsetModeChange(mode: typeof charsetMode.value) {
  charsetMode.value = mode;
  if (mode === 'digits') letterCase.value = 'none';
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader title="随机字符串生成" description="生成指定长度和字符集的随机字符串，支持大小写转换与批量输出。" @example="generate" />

    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">长度</span>
        <input v-model.number="length" type="number" min="1" max="4096" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[64px]" />
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">字符集</span>
        <div class="flex gap-1 flex-wrap">
          <button v-for="[mode, label] in [['alphanumeric', '字母 + 数字'], ['digits', '仅数字'], ['special', '含特殊字符'], ['custom', '自定义']] as const" :key="mode" :class="['px-2 py-1 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150', charsetMode === mode ? 'bg-accent border-accent text-white' : 'bg-surface border-border text-text hover:bg-hover hover:border-accent']" @click="onCharsetModeChange(mode)">{{ label }}</button>
        </div>
      </div>

      <div v-if="showLetterCase" class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">大小写</span>
        <div class="flex gap-1">
          <button v-for="[val, label] in [['none', '保持'], ['upper', '大写'], ['lower', '小写']] as const" :key="val" :class="['px-2 py-1 border rounded-sm text-[0.8125rem] font-sans cursor-pointer transition-[background-color,border-color] duration-150', letterCase === val ? 'bg-accent border-accent text-white' : 'bg-surface border-border text-text hover:bg-hover hover:border-accent']" @click="letterCase = val as any">{{ label }}</button>
        </div>
      </div>

      <div v-if="charsetMode === 'custom'" class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">自定义字符</span>
        <input v-model="customChars" type="text" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[240px]" placeholder="输入字符集，如 ABC123" />
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">数量</span>
        <input v-model.number="count" type="number" min="1" max="1000" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[64px]" />
        <span class="text-[0.8125rem] text-muted">条</span>
      </div>

      <div class="flex gap-2">
        <button class="px-4 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90" @click="generate">生成</button>
        <button class="px-4 py-2 bg-surface border border-border text-text rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:bg-hover hover:border-accent" @click="generate">重新生成</button>
      </div>
    </div>

    <div class="border border-border rounded-md bg-card mt-4 min-h-[120px]">
      <div v-if="results.length === 0" class="flex items-center justify-center h-[120px] text-muted text-sm">点击「生成」按钮查看结果</div>
      <template v-else>
        <div class="flex justify-between items-center px-4 py-2 border-b border-border sticky top-0 bg-card rounded-t-md z-[1]">
          <span class="text-xs text-muted">共 {{ results.length }} 条</span>
          <button class="px-2 py-1 bg-surface border border-border text-text rounded-sm text-xs font-sans cursor-pointer hover:bg-hover hover:border-accent" @click="copyAll">复制全部</button>
        </div>
        <div class="max-h-[400px] overflow-y-auto px-4 py-2 flex flex-col gap-1">
          <div v-for="(str, i) in results" :key="i" class="flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer hover:bg-hover transition-colors duration-150" @click="copySingle(str)">
            <span class="text-xs text-muted min-w-[28px] text-right shrink-0">{{ i + 1 }}</span>
            <code class="flex-1 text-[0.8125rem] text-text break-all">{{ str }}</code>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
