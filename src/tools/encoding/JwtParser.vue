<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';

import SelectListbox from '../../components/ui/SelectListbox.vue';
import {
  parseJwt,
  isTokenExpired,
  verifyHmacSignature,
  encodeJwt,
  JWT_CLAIM_LABELS,
} from '../../utils/encoding/jwt';
import dayjs from 'dayjs';

type Mode = 'parse' | 'encode';
const mode = ref<Mode>('parse');

// ==================== Parse Mode ====================
const tokenInput = ref('');
const parsed = ref<ReturnType<typeof parseJwt> | null>(null);
const parseError = ref('');
const expandedClaims = reactive<Set<string>>(new Set());
const parseResultTab = ref<'header' | 'payload' | 'signature'>('payload');

function runParse() {
  parseError.value = '';
  expandedClaims.clear();
  const result = parseJwt(tokenInput.value);
  if (result.error) {
    parseError.value = result.error;
    parsed.value = null;
  } else {
    parsed.value = result;
  }
}

function getClaimLabel(key: string): string | undefined {
  return JWT_CLAIM_LABELS[key];
}

function isStandardClaim(key: string): boolean {
  return key in JWT_CLAIM_LABELS;
}

function isJsonValue(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function isComplexJson(value: unknown): boolean {
  if (!isJsonValue(value)) return false;
  const json = JSON.stringify(value);
  return json.length > 60;
}

function formatJsonPreview(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length <= 60) return json;
  return json.slice(0, 57) + '...';
}

function formatJsonPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function toggleExpand(key: string) {
  if (expandedClaims.has(key)) {
    expandedClaims.delete(key);
  } else {
    expandedClaims.add(key);
  }
}

function formatClaimValue(key: string, value: unknown): string {
  if (typeof value === 'number' && (key === 'iat' || key === 'exp' || key === 'nbf')) {
    return `${value} (${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')})`;
  }
  return String(value);
}

function getTimestampHint(key: string, value: unknown): string | null {
  if (typeof value !== 'number') return null;
  if (isStandardClaim(key)) return null;
  if (value > 946684800 && value < 4102444800) {
    return `可能是时间戳: ${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}`;
  }
  if (value > 946684800000 && value < 4102444800000) {
    return `可能是时间戳: ${dayjs(value).format('YYYY-MM-DD HH:mm:ss')}`;
  }
  return null;
}

const expiredStatus = computed(() => {
  if (!parsed.value?.payload) return null;
  return isTokenExpired(parsed.value.payload);
});

const standardClaims = computed(() => {
  if (!parsed.value?.payload) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.value.payload)) {
    if (isStandardClaim(key)) result[key] = value;
  }
  return result;
});

const customClaims = computed(() => {
  if (!parsed.value?.payload) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.value.payload)) {
    if (!isStandardClaim(key)) result[key] = value;
  }
  return result;
});

const hasCustomClaims = computed(() => Object.keys(customClaims.value).length > 0);

function segmentJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

// Signature verification state
const HMAC_ALGORITHMS = ['HS256', 'HS384', 'HS512'] as const;
type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number];

const verifyAlgorithm = ref<HmacAlgorithm>('HS256');
const verifySecret = ref('');
const verifySecretVisible = ref(false);
const verifyResult = ref<boolean | null>(null);
const verifyLoading = ref(false);

watch(
  () => parsed.value?.header?.alg,
  (alg) => {
    if (alg === 'HS256' || alg === 'HS384' || alg === 'HS512') {
      verifyAlgorithm.value = alg;
    } else {
      verifyAlgorithm.value = 'HS256';
    }
  },
);

watch([verifySecret, verifyAlgorithm], () => {
  verifyResult.value = null;
});

async function handleVerify() {
  if (!parsed.value || !verifySecret.value) return;
  verifyLoading.value = true;
  verifyResult.value = null;
  try {
    verifyResult.value = await verifyHmacSignature(
      tokenInput.value,
      verifySecret.value,
      verifyAlgorithm.value,
    );
  } catch {
    verifyResult.value = false;
  } finally {
    verifyLoading.value = false;
  }
}

// ==================== Encode Mode ====================
const encodeAlgorithm = ref<HmacAlgorithm>('HS256');
const encodeSecret = ref('');
const encodeSecretVisible = ref(true);
const encodedToken = ref('');
const encodeError = ref('');

// Quick claim fields
const quickClaims = reactive<Record<string, string>>({
  iss: '',
  sub: '',
  aud: '',
  exp: '',
  nbf: '',
  iat: '',
  jti: '',
});

// Custom JSON payload
const customPayloadJson = ref('');

function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_@#$%&*';
  let result = '';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 32; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Build final payload from quick claims + custom JSON
function buildPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // Add quick claims (only if not empty)
  for (const [key, value] of Object.entries(quickClaims)) {
    if (value.trim() === '') continue;
    if (key === 'exp' || key === 'nbf' || key === 'iat') {
      // Only accept numeric timestamp
      const num = Number(value.trim());
      if (!isNaN(num)) {
        payload[key] = num;
      }
      // Invalid timestamp: skip silently
    } else {
      payload[key] = value.trim();
    }
  }

  // Merge custom JSON
  if (customPayloadJson.value.trim()) {
    try {
      const custom = JSON.parse(customPayloadJson.value.trim());
      if (typeof custom === 'object' && custom !== null && !Array.isArray(custom)) {
        Object.assign(payload, custom);
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return payload;
}

async function handleEncode() {
  encodeError.value = '';
  encodedToken.value = '';

  if (!encodeSecret.value) {
    encodeError.value = '请输入 HMAC 密钥';
    return;
  }

  const payload = buildPayload();
  if (Object.keys(payload).length === 0) {
    encodeError.value = 'Payload 不能为空，请至少填写一个声明字段或自定义 JSON';
    return;
  }

  try {
    encodedToken.value = await encodeJwt({
      payload,
      secret: encodeSecret.value,
      algorithm: encodeAlgorithm.value,
    });
  } catch (e) {
    encodeError.value = e instanceof Error ? e.message : '编码失败';
  }
}

function handleClearParse() {
  tokenInput.value = '';
  parsed.value = null;
  parseError.value = '';
  expandedClaims.clear();
  verifySecret.value = '';
  verifyResult.value = null;
}

function handleClearEncode() {
  encodeSecret.value = '';
  encodedToken.value = '';
  encodeError.value = '';
  for (const key of Object.keys(quickClaims)) {
    quickClaims[key] = '';
  }
  customPayloadJson.value = '';
}

// Watch mode switch to clear states
watch(mode, (newMode) => {
  if (newMode === 'parse') {
    handleClearEncode();
  } else {
    handleClearParse();
  }
});

// Auto-fill iat with current timestamp when entering encode mode
watch(mode, (newMode) => {
  if (newMode === 'encode' && !quickClaims.iat) {
    quickClaims.iat = String(dayjs().unix());
  }
});
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="JWT 解析器"
      description="解析和生成 JSON Web Token，支持 HMAC 签名验证与编码"
      :show-example="false"
    />

    <ModeTabGroup
      v-model="mode"
      :options="[
        { key: 'parse', label: '解析' },
        { key: 'encode', label: '编码' },
      ]"
    />

    <!-- ==================== Parse Mode ==================== -->
    <template v-if="mode === 'parse'">
      <!-- Token 输入 -->
      <div class="mb-3">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入 JWT Token</label>
        <textarea
          v-model="tokenInput"
          class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="4"
          placeholder="粘贴 JWT Token..."
          @input="runParse()"
        ></textarea>
      </div>

      <div class="flex gap-2 items-center mb-4">
        <ClearButton @clear="handleClearParse" />
      </div>

      <!-- 解析错误 -->
      <p v-if="parseError" class="text-error text-[0.8125rem] m-0 mb-4">{{ parseError }}</p>

      <!-- 过期状态 -->
      <div v-if="expiredStatus !== null" :class="['inline-block px-4 py-1 rounded-sm text-xs font-semibold mb-4', expiredStatus ? 'bg-red-100 text-error' : 'bg-green-100 text-success']">
        {{ expiredStatus ? 'Token 已过期' : 'Token 未过期' }}
      </div>

      <!-- 解析结果 Tab -->
      <div class="border border-border rounded-md bg-card overflow-hidden">
        <div class="flex border-b border-border bg-hover">
          <button
            v-for="tab in [
              { key: 'header' as const, label: 'Header', dot: 'bg-red-500' },
              { key: 'payload' as const, label: 'Payload', dot: 'bg-violet-500' },
              { key: 'signature' as const, label: 'Signature', dot: 'bg-green-500' },
            ]"
            :key="tab.key"
            class="flex-1 px-4 py-2 text-[0.8125rem] font-medium cursor-pointer border-none bg-transparent text-text hover:bg-hover transition-colors"
            :class="parseResultTab === tab.key ? 'border-b-2 border-accent text-accent' : ''"
            @click="parseResultTab = tab.key"
          >
            <span class="inline-block w-2 h-2 rounded-full mr-1.5" :class="tab.dot"></span>
            {{ tab.label }}
          </button>
        </div>

        <div class="p-4">
          <template v-if="parsed && !parseError">
            <!-- Header Tab -->
            <div v-if="parseResultTab === 'header'">
              <pre class="m-0 mb-3 px-4 py-2 bg-hover rounded-sm font-mono text-[0.8125rem] whitespace-pre-wrap break-all">{{ segmentJson(parsed.header) }}</pre>
              <CopyButton :text="segmentJson(parsed.header)" />
            </div>

            <!-- Payload Tab -->
            <div v-else-if="parseResultTab === 'payload'">
              <!-- 标准声明 -->
              <div class="flex flex-col gap-1 mb-2">
                <div v-for="(value, key) in standardClaims" :key="String(key)" class="flex items-baseline gap-4 py-1 border-b border-border last:border-b-0">
                  <span class="font-mono text-[0.8125rem] font-semibold min-w-[120px] text-text">
                    {{ key }}
                    <span v-if="getClaimLabel(String(key))" class="text-[0.6875rem] font-normal text-muted ml-1">{{ getClaimLabel(String(key)) }}</span>
                  </span>
                  <span class="font-mono text-[0.8125rem] text-text break-all">{{ formatClaimValue(String(key), value) }}</span>
                </div>
              </div>

              <!-- 自定义声明 -->
              <template v-if="hasCustomClaims">
                <div class="border-t border-border my-2"></div>
                <div class="text-[0.75rem] font-semibold text-muted mb-2">自定义声明</div>
                <div class="flex flex-col gap-1 mb-2">
                  <div v-for="(value, key) in customClaims" :key="String(key)" class="py-1 border-b border-border last:border-b-0">
                    <div class="flex items-baseline gap-4">
                      <span class="font-mono text-[0.8125rem] font-semibold min-w-[120px] text-text">
                        {{ key }}
                      </span>

                      <!-- JSON 值（展开/收起） -->
                      <div v-if="isJsonValue(value)" class="flex-1 min-w-0">
                        <button
                          v-if="isComplexJson(value)"
                          class="text-[0.6875rem] text-accent hover:underline mr-2 cursor-pointer bg-transparent border-none p-0"
                          @click="toggleExpand(String(key))"
                        >
                          {{ expandedClaims.has(String(key)) ? '收起' : '展开' }}
                        </button>
                        <pre v-if="expandedClaims.has(String(key))" class="m-0 px-3 py-1.5 bg-hover rounded-sm font-mono text-[0.8125rem] whitespace-pre-wrap break-all mt-1">{{ formatJsonPretty(value) }}</pre>
                        <span v-else class="font-mono text-[0.8125rem] text-text break-all">{{ formatJsonPreview(value) }}</span>
                      </div>

                      <!-- 简单值 -->
                      <span v-else class="font-mono text-[0.8125rem] text-text break-all">{{ formatClaimValue(String(key), value) }}</span>
                    </div>

                    <!-- 时间戳提示 -->
                    <div v-if="getTimestampHint(String(key), value)" class="text-[0.6875rem] text-muted mt-0.5 ml-[136px]">
                      {{ getTimestampHint(String(key), value) }}
                    </div>
                  </div>
                </div>
              </template>

              <CopyButton :text="segmentJson(parsed.payload)" />
            </div>

            <!-- Signature Tab -->
            <div v-else-if="parseResultTab === 'signature'">
              <code class="block font-mono text-[0.8125rem] break-all text-text mb-3">{{ parsed.signature }}</code>
              <CopyButton :text="parsed.signature" />
            </div>
          </template>

          <template v-else>
            <div class="text-muted text-sm text-center py-8">粘贴 JWT Token 开始解析</div>
          </template>
        </div>
      </div>

      <!-- 验证签名面板 -->
      <div class="border-t border-border pt-4 mt-4">
        <h3 class="text-[0.8125rem] text-muted font-medium">验证签名</h3>
        <div class="pt-2">
          <div class="flex flex-col gap-3">
            <SelectListbox
              v-model="verifyAlgorithm"
              :options="[{value:'HS256',label:'HS256'},{value:'HS384',label:'HS384'},{value:'HS512',label:'HS512'}]"
              label="算法"
            />

            <div class="flex flex-col gap-1">
              <label class="block text-[0.8125rem] text-muted font-medium mb-1">密钥</label>
              <div class="flex gap-2">
                <input
                  v-model="verifySecret"
                  :type="verifySecretVisible ? 'text' : 'password'"
                  placeholder="输入 HMAC 密钥"
                  class="flex-1 px-3 py-1.5 border border-border rounded-sm text-[0.8125rem] font-mono bg-card text-text focus:outline-none focus:border-accent"
                />
                <button
                  class="px-2.5 py-1.5 border border-border rounded-sm text-[0.75rem] cursor-pointer bg-card text-text hover:bg-hover"
                  @click="verifySecretVisible = !verifySecretVisible"
                >
                  {{ verifySecretVisible ? '隐藏' : '显示' }}
                </button>
              </div>
            </div>

            <button
              class="self-start px-4 py-1.5 rounded-sm text-[0.8125rem] font-semibold cursor-pointer border-none text-white"
              :class="verifySecret && !verifyLoading ? 'bg-accent hover:opacity-90' : 'bg-gray-400 cursor-not-allowed'"
              :disabled="!verifySecret || verifyLoading"
              @click="handleVerify"
            >
              {{ verifyLoading ? '验证中...' : '验证' }}
            </button>

            <p v-if="verifyResult === true" class="text-success text-[0.8125rem] m-0">✅ 签名匹配</p>
            <p v-if="verifyResult === false" class="text-error text-[0.8125rem] m-0">❌ 签名不匹配</p>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== Encode Mode ==================== -->
    <template v-else>
      <!-- 算法 & 密钥 -->
      <div class="flex flex-col gap-3 mb-4">
        <SelectListbox
          v-model="encodeAlgorithm"
          :options="[{value:'HS256',label:'HS256'},{value:'HS384',label:'HS384'},{value:'HS512',label:'HS512'}]"
          label="签名算法"
        />

        <div class="flex flex-col gap-1">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">HMAC 密钥 <span class="text-error">*</span></label>
          <div class="flex gap-2">
            <input
              v-model="encodeSecret"
              :type="encodeSecretVisible ? 'text' : 'password'"
              placeholder="输入 HMAC 密钥"
              class="flex-1 px-3 py-1.5 border border-border rounded-sm text-[0.8125rem] font-mono bg-card text-text focus:outline-none focus:border-accent"
            />
            <button
              class="px-2.5 py-1.5 border border-border rounded-sm text-[0.75rem] cursor-pointer bg-card text-text hover:bg-hover"
              @click="encodeSecretVisible = !encodeSecretVisible"
            >
              {{ encodeSecretVisible ? '隐藏' : '显示' }}
            </button>
            <button
              class="px-2.5 py-1.5 border border-border rounded-sm text-[0.75rem] cursor-pointer bg-card text-text hover:bg-hover"
              @click="encodeSecret = generateRandomSecret()"
            >
              随机生成
            </button>
          </div>
        </div>
      </div>

      <!-- 标准声明 -->
      <div class="border border-border rounded-md p-4 bg-card mb-4">
        <div class="text-sm font-semibold mb-3">标准声明（可选）</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-for="label in ['iss', 'sub', 'aud', 'jti']" :key="label" class="flex flex-col gap-1">
            <label class="text-[0.8125rem] text-muted font-medium">
              {{ label }}
              <span class="text-[0.6875rem] text-muted ml-1">{{ JWT_CLAIM_LABELS[label] }}</span>
            </label>
            <input
              v-model="quickClaims[label]"
              type="text"
              :placeholder="`输入 ${label}`"
              class="px-3 py-1.5 border border-border rounded-sm text-[0.8125rem] font-mono bg-card text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div v-for="label in ['iat', 'exp', 'nbf']" :key="label" class="flex flex-col gap-1">
            <label class="text-[0.8125rem] text-muted font-medium">
              {{ label }}
              <span class="text-[0.6875rem] text-muted ml-1">{{ JWT_CLAIM_LABELS[label] }}</span>
            </label>
            <input
              v-model="quickClaims[label]"
              type="text"
              placeholder="Unix 时间戳"
              class="px-3 py-1.5 border border-border rounded-sm text-[0.8125rem] font-mono bg-card text-text focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      <!-- 自定义 Payload JSON -->
      <div class="mb-4">
        <label class="block text-[0.8125rem] text-muted font-medium mb-1">自定义 Payload（JSON 对象，可选）</label>
        <textarea
          v-model="customPayloadJson"
          class="w-full px-4 py-2 border border-border rounded-sm text-[0.8125rem] font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
          rows="4"
          placeholder='{"role": "admin", "permissions": ["read", "write"]}'
        ></textarea>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-2 items-center mb-4">
        <button
          class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
          @click="handleEncode"
        >生成 Token</button>
        <ClearButton @clear="handleClearEncode" />
      </div>

      <!-- 编码错误 -->
      <p v-if="encodeError" class="text-error text-[0.8125rem] m-0 mb-4">{{ encodeError }}</p>

      <!-- 生成的 Token 输出 -->
      <div v-if="encodedToken" class="mb-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">生成的 JWT Token</span>
          <CopyButton :text="encodedToken" />
        </div>
        <div class="border border-border rounded-md p-4 bg-card">
          <code class="font-mono text-[0.8125rem] break-all text-text">{{ encodedToken }}</code>
        </div>
      </div>
    </template>
  </div>
</template>
