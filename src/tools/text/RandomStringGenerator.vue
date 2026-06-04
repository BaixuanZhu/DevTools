<script setup lang="ts">
import { ref, computed } from 'vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import {
  CHAR_SETS,
  resolveCharsetFromTypes,
  generateRandomString,
  transformOutput,
  type CharType,
  type OutputFormat,
} from '../../utils/text/random-string';

// === 字符类型 ===
const charTypes = ref<Record<CharType, boolean>>({
  uppercase: true,
  lowercase: true,
  digits: true,
  special: false,
});
const customSpecial = ref('!@#$%^&*()_+-=[]{}|;:,.<>?/');
const length = ref(16);
const count = ref(1);

// === 输出格式（统一 Radio，7 选 1）===
const outputFormat = ref<OutputFormat>('none');

// === 结果 ===
const results = ref<string[]>([]);

// === 计算属性 ===
const hasChecked = computed(() => Object.values(charTypes.value).some((v) => v));
const specialMissing = computed(() => charTypes.value.special && !customSpecial.value.trim());

function charsetHint(): string {
  const parts: string[] = [];
  if (charTypes.value.uppercase) parts.push('A-Z');
  if (charTypes.value.lowercase) parts.push('a-z');
  if (charTypes.value.digits) parts.push('0-9');
  if (charTypes.value.special) parts.push('特殊');
  return parts.join(' + ') || '无';
}

// === 生成 ===
function generate() {
  const types = (Object.keys(charTypes.value) as CharType[]).filter((k) => charTypes.value[k]);
  if (types.length === 0) return;
  if (charTypes.value.special && !customSpecial.value.trim()) return;

  const charset = resolveCharsetFromTypes(types, customSpecial.value);
  const safeCount = Math.min(Math.max(count.value, 1), 500);
  const safeLength = Math.min(Math.max(length.value, 1), 2048);
  const arr: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const raw = generateRandomString(safeLength, charset);
    arr.push(transformOutput(raw, outputFormat.value));
  }
  results.value = arr;
}

// === 复制 ===
function copySingle(str: string) {
  navigator.clipboard.writeText(str).then(() => {
    document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: '已复制' } }));
  });
}

function copyAll() {
  const text = results.value.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    document.dispatchEvent(
      new CustomEvent('toast', { detail: { type: 'success', message: `已复制 ${results.value.length} 条` } }),
    );
  });
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="随机字符串生成"
      description="生成密码学安全的随机字符串，支持大小写、编码等多种输出格式"
      @example="generate"
    />

    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <!-- 字符类型 Switches -->
      <div class="flex items-center gap-4 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">字符类型</span>
        <div class="flex items-center gap-3">
          <ToggleSwitch v-model="charTypes.uppercase" description="A-Z" />
          <ToggleSwitch v-model="charTypes.lowercase" description="a-z" />
          <ToggleSwitch v-model="charTypes.digits" description="0-9" />
        </div>
      </div>

      <!-- 特殊字符 -->
      <div class="flex items-center gap-4 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[72px] shrink-0">特殊字符</span>
        <div class="flex items-center gap-2">
          <ToggleSwitch v-model="charTypes.special" description="特殊" />
          <input
            v-if="charTypes.special"
            v-model="customSpecial"
            type="text"
            class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[260px]"
            placeholder="自定义特殊字符"
          />
        </div>
      </div>

      <!-- 字符池预览 -->
      <div class="text-[0.75rem] text-muted">
        字符池：<span class="text-accent font-mono">{{ charsetHint() }}</span>
      </div>

      <!-- 输出格式 -->
      <OptionRadioGroup
        v-model="outputFormat"
        label="输出格式"
        :options="[
          { value: 'none', label: '保持' },
          { value: 'upper', label: '全大写' },
          { value: 'lower', label: '全小写' },
          { value: 'hex', label: 'Hex' },
          { value: 'base64', label: 'Base64' },
          { value: 'binary', label: '二进制' },
          { value: 'octal', label: '八进制' },
        ]"
      />

      <!-- 长度 + 数量 并排 -->
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="text-[0.8125rem] text-muted">长度</span>
          <input
            v-model.number="length"
            type="number"
            min="1"
            max="2048"
            class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[72px]"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[0.8125rem] text-muted">数量</span>
          <input
            v-model.number="count"
            type="number"
            min="1"
            max="500"
            class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[72px]"
          />
          <span class="text-[0.8125rem] text-muted">条</span>
        </div>
      </div>

      <!-- 按钮 + 校验提示 -->
      <div class="flex flex-col gap-1">
        <div class="flex gap-2">
          <button
            :disabled="!hasChecked || specialMissing"
            class="px-6 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="generate"
          >
            生成
          </button>
          <button
            :disabled="!hasChecked || specialMissing"
            class="px-6 py-2 bg-surface border border-border text-text rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:bg-hover hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            @click="generate"
          >
            重新生成
          </button>
        </div>
        <p v-if="!hasChecked" class="text-xs text-error">请至少选择一种字符类型</p>
        <p v-if="specialMissing" class="text-xs text-error">请输入特殊字符</p>
      </div>
    </div>

    <!-- 结果面板 -->
    <div class="mt-6">
      <div v-if="results.length === 0" class="border border-border rounded-md bg-card min-h-[120px] flex items-center justify-center">
        <p class="text-muted text-[0.8125rem]">配置参数后点击「生成」</p>
      </div>

      <div v-else class="border border-border rounded-md bg-card overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2 border-b border-border sticky top-0 bg-card z-10">
          <span class="text-[0.8125rem] text-muted">共 {{ results.length }} 条</span>
          <button
            class="px-3 py-1 border border-border rounded-sm text-[0.8125rem] text-text cursor-pointer hover:bg-hover hover:border-accent transition-[background-color,border-color] duration-150"
            @click="copyAll"
          >
            复制全部
          </button>
        </div>
        <div class="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-1">
          <div
            v-for="(str, idx) in results"
            :key="idx"
            class="flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer hover:bg-hover transition-[background-color] duration-150 group"
            @click="copySingle(str)"
          >
            <span class="text-[0.75rem] text-muted min-w-[32px] text-right shrink-0">{{ idx + 1 }}</span>
            <code class="text-[0.8125rem] font-mono text-text break-all flex-1">{{ str }}</code>
            <span class="text-[0.75rem] text-muted opacity-0 group-hover:opacity-100 shrink-0 transition-[opacity] duration-150">复制</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
