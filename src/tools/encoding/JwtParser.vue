<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import DisclosureSection from '../../components/ui/DisclosureSection.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import { parseJwt, isTokenExpired, verifyHmacSignature, JWT_CLAIM_LABELS } from '../../utils/encoding/jwt';
import dayjs from 'dayjs';

const tokenInput = ref('');
const parsed = ref<ReturnType<typeof parseJwt> | null>(null);
const errorMsg = ref('');
const expandedClaims = reactive<Set<string>>(new Set());

function parse() {
  errorMsg.value = '';
  expandedClaims.clear();
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

function handleExample() {
  tokenInput.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.4DLyM2DJpI8jiV8sRz7i1MSsiWRF7LPtIMzflaU6mFs';
  parse();
}

function handleClear() {
  tokenInput.value = '';
  parsed.value = null;
  errorMsg.value = '';
  expandedClaims.clear();
}

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

// Auto-select algorithm from parsed header
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

// Clear result when secret or algorithm changes
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
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="JWT 解析器"
      description="解析和验证 JSON Web Token，展示 Header、Payload、Signature"
      @example="handleExample"
    />

    <div class="mb-4">
      <label class="block text-[0.8125rem] text-muted font-medium mb-1">输入 JWT Token</label>
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

        <!-- Standard claims -->
        <div class="flex flex-col gap-1 mb-2">
          <div v-for="(value, key) in standardClaims" :key="String(key)" class="flex items-baseline gap-4 py-1 border-b border-border last:border-b-0">
            <span class="font-mono text-[0.8125rem] font-semibold min-w-[120px] text-text">
              {{ key }}
              <span v-if="getClaimLabel(String(key))" class="text-[0.6875rem] font-normal text-muted ml-1">{{ getClaimLabel(String(key)) }}</span>
            </span>
            <span class="font-mono text-[0.8125rem] text-text break-all">{{ formatClaimValue(String(key), value) }}</span>
          </div>
        </div>

        <!-- Custom claims section -->
        <template v-if="hasCustomClaims">
          <div class="border-t border-border my-2"></div>
          <div class="text-[0.75rem] font-semibold text-muted mb-2">自定义声明</div>
          <div class="flex flex-col gap-1 mb-2">
            <div v-for="(value, key) in customClaims" :key="String(key)" class="py-1 border-b border-border last:border-b-0">
              <div class="flex items-baseline gap-4">
                <span class="font-mono text-[0.8125rem] font-semibold min-w-[120px] text-text">
                  {{ key }}
                </span>

                <!-- JSON value with expand/collapse -->
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

                <!-- Simple value -->
                <span v-else class="font-mono text-[0.8125rem] text-text break-all">{{ formatClaimValue(String(key), value) }}</span>
              </div>

              <!-- Timestamp hint for numeric values -->
              <div v-if="getTimestampHint(String(key), value)" class="text-[0.6875rem] text-muted mt-0.5 ml-[136px]">
                {{ getTimestampHint(String(key), value) }}
              </div>
            </div>
          </div>
        </template>

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

      <!-- Verify Signature Panel -->
      <DisclosureSection title="验证签名">
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
      </DisclosureSection>
    </div>

    <div v-if="parsed && !errorMsg" class="mt-4">
      <ClearButton @clear="handleClear" />
    </div>
  </div>
</template>
