<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import { parseJwt, isTokenExpired, JWT_CLAIM_LABELS } from '../../utils/encoding/jwt';
import dayjs from 'dayjs';

const tokenInput = ref('');
const parsed = ref<ReturnType<typeof parseJwt> | null>(null);
const errorMsg = ref('');

function parse() {
  errorMsg.value = '';
  const result = parseJwt(tokenInput.value);
  if (result.error) {
    errorMsg.value = result.error;
    parsed.value = null;
  } else {
    parsed.value = result;
  }
}

function getClaimLabel(key: string): string | undefined {
  return JWT_CLAIM_LABELS[key];
}

function formatClaimValue(key: string, value: unknown): string {
  if (typeof value === 'number' && (key === 'iat' || key === 'exp' || key === 'nbf')) {
    return `${value} (${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')})`;
  }
  return String(value);
}

const expiredStatus = computed(() => {
  if (!parsed.value?.payload) return null;
  return isTokenExpired(parsed.value.payload);
});

function handleExample() {
  tokenInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.4DLyM2DJpI8jiV8sRz7i1MSsiWRF7LPtIMzflaU6mFs';
  parse();
}

function handleClear() {
  tokenInput.value = '';
  parsed.value = null;
  errorMsg.value = '';
}

function segmentJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="JWT 解析器"
      description="解析和验证 JSON Web Token，展示 Header、Payload、Signature"
      @example="handleExample"
    />

    <div class="mb-4">
      <label class="field-label">输入 JWT Token</label>
      <textarea
        v-model="tokenInput"
        class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
        rows="4"
        placeholder="粘贴 JWT Token..."
        @input="parse()"
      ></textarea>
    </div>

    <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mb-4">{{ errorMsg }}</p>

    <div v-if="expiredStatus !== null" :class="['inline-block px-4 py-1 rounded-sm text-xs font-semibold mb-4', expiredStatus ? 'bg-red-100 text-error' : 'bg-green-100 text-success']">
      {{ expiredStatus ? 'Token 已过期' : 'Token 未过期' }}
    </div>

    <div v-if="parsed && !errorMsg" class="flex flex-col gap-4">
      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-center gap-2 text-sm font-semibold mb-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
          Header
        </div>
        <pre class="m-0 mb-2 px-4 py-2 bg-hover rounded-sm font-mono text-[0.8125rem] whitespace-pre-wrap break-all">{{ segmentJson(parsed.header) }}</pre>
        <CopyButton :text="segmentJson(parsed.header)" label="复制 JSON" />
      </div>

      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-center gap-2 text-sm font-semibold mb-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-violet-500"></span>
          Payload
        </div>
        <div class="flex flex-col gap-1 mb-2">
          <div v-for="(value, key) in parsed.payload" :key="String(key)" class="flex items-baseline gap-4 py-1 border-b border-border last:border-b-0">
            <span class="font-mono text-[0.8125rem] font-semibold min-w-[120px] text-text">
              {{ key }}
              <span v-if="getClaimLabel(String(key))" class="text-[0.6875rem] font-normal text-muted ml-1">{{ getClaimLabel(String(key)) }}</span>
            </span>
            <span class="font-mono text-[0.8125rem] text-text break-all">{{ formatClaimValue(String(key), value) }}</span>
          </div>
        </div>
        <CopyButton :text="segmentJson(parsed.payload)" label="复制 JSON" />
      </div>

      <div class="border border-border rounded-md p-4 bg-card">
        <div class="flex items-center gap-2 text-sm font-semibold mb-2">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span>
          Signature
        </div>
        <code class="block font-mono text-[0.8125rem] break-all text-text mb-2">{{ parsed.signature }}</code>
        <CopyButton :text="parsed.signature" label="复制" />
      </div>
    </div>

    <div v-if="parsed && !errorMsg" class="mt-4">
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>
