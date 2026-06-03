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

/** 获取声明值的中文说明 */
function getClaimLabel(key: string): string | undefined {
  return JWT_CLAIM_LABELS[key];
}

/** 格式化时间戳声明值 */
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
  <div class="jwt-tool">
    <ToolHeader
      title="JWT 解析器"
      description="解析和验证 JSON Web Token，展示 Header、Payload、Signature"
      @example="handleExample"
    />

    <div class="input-section">
      <label class="field-label">输入 JWT Token</label>
      <textarea
        v-model="tokenInput"
        class="field-textarea"
        rows="4"
        placeholder="粘贴 JWT Token..."
        @input="parse()"
      ></textarea>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

    <div v-if="expiredStatus !== null" :class="['status-badge', expiredStatus ? 'expired' : 'valid']">
      {{ expiredStatus ? 'Token 已过期' : 'Token 未过期' }}
    </div>

    <div v-if="parsed && !errorMsg" class="segments">
      <div class="segment-card segment-header">
        <div class="segment-title">
          <span class="segment-dot header-dot"></span>
          Header
        </div>
        <pre class="segment-json">{{ segmentJson(parsed.header) }}</pre>
        <CopyButton :text="segmentJson(parsed.header)" label="复制 JSON" />
      </div>

      <div class="segment-card segment-payload">
        <div class="segment-title">
          <span class="segment-dot payload-dot"></span>
          Payload
        </div>
        <div class="payload-claims">
          <div v-for="(value, key) in parsed.payload" :key="String(key)" class="claim-row">
            <span class="claim-key">
              {{ key }}
              <span v-if="getClaimLabel(String(key))" class="claim-label">{{ getClaimLabel(String(key)) }}</span>
            </span>
            <span class="claim-value">{{ formatClaimValue(String(key), value) }}</span>
          </div>
        </div>
        <CopyButton :text="segmentJson(parsed.payload)" label="复制 JSON" />
      </div>

      <div class="segment-card segment-signature">
        <div class="segment-title">
          <span class="segment-dot sig-dot"></span>
          Signature
        </div>
        <code class="sig-value">{{ parsed.signature }}</code>
        <CopyButton :text="parsed.signature" label="复制" />
      </div>
    </div>

    <div v-if="parsed && !errorMsg" class="clear-bar">
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>

<style scoped>
.jwt-tool { max-width: 720px; }

.input-section {
  margin-bottom: var(--space-md);
}

.field-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  background-color: var(--color-card);
  resize: vertical;
  box-sizing: border-box;
}

.field-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.error-msg {
  color: var(--color-error);
  font-size: 0.8125rem;
  margin: 0 0 var(--space-md);
}

.status-badge {
  display: inline-block;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.status-badge.valid {
  background-color: #dcfce7;
  color: var(--color-success);
}

.status-badge.expired {
  background-color: #fee2e2;
  color: var(--color-error);
}

.segments {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.segment-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  background-color: var(--color-card);
}

.segment-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

.segment-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.header-dot { background-color: #ef4444; }
.payload-dot { background-color: #8b5cf6; }
.sig-dot { background-color: #22c55e; }

.segment-json {
  margin: 0 0 var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-hover);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.payload-claims {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.claim-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-md);
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--color-border);
}

.claim-row:last-child { border-bottom: none; }

.claim-key {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  min-width: 120px;
  color: var(--color-text);
}

.claim-label {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--color-muted);
  margin-left: var(--space-xs);
}

.claim-value {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--color-text);
  word-break: break-all;
}

.sig-value {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  word-break: break-all;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.clear-bar { margin-top: var(--space-md); }
</style>
