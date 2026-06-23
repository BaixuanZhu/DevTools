<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCopy } from '../../composables/useCopy';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import SelectListbox from '../../components/ui/SelectListbox.vue';
import type { UuidVersion, UuidFormat, DecodedUuid } from '../../utils/text/uuid-generator';
import {
  generateUuids,
  getConvertedUuid,
  getConversionLabel,
  hasConversion,
  isNamespaceVersion,
  formatUuid,
  decodeUuid,
  getVersionDescription,
  VERSION_OPTIONS,
  FORMAT_OPTIONS,
  NAMESPACE_PRESET_OPTIONS,
  NAMESPACE_PRESETS,
} from '../../utils/text/uuid-generator';

const version = ref<UuidVersion>('v4');
const outputFormat = ref<UuidFormat>('lowercase');
const namespacePreset = ref<string>('DNS');
const namespaceUuid = ref<string>(NAMESPACE_PRESETS.DNS);
const nameValue = ref('');
const count = ref(1);
const enableConversion = ref(false);
const results = ref<string[]>([]);
const convertedResults = ref<(string | null)[]>([]);
const decodeInput = ref('');
const decodeResult = ref<DecodedUuid | null>(null);

// Computed
const showNamespace = computed(() => isNamespaceVersion(version.value));
const showConversion = computed(() => hasConversion(version.value));
const convLabel = computed(() => getConversionLabel(version.value));
const versionDescription = computed(() => getVersionDescription(version.value));

const formattedResults = computed(() =>
  results.value.map((u) => formatUuid(u, outputFormat.value)),
);

const formattedConverted = computed(() =>
  convertedResults.value.map((u) => (u ? formatUuid(u, outputFormat.value) : null)),
);

// Watchers
watch(version, () => {
  enableConversion.value = false;
});

watch(namespacePreset, (preset) => {
  if (preset === 'custom') {
    namespaceUuid.value = '';
  } else {
    namespaceUuid.value =
      NAMESPACE_PRESETS[preset as keyof typeof NAMESPACE_PRESETS] ?? '';
  }
});

watch(decodeInput, (input) => {
  const trimmed = input.trim();
  decodeResult.value = trimmed ? decodeUuid(trimmed) : null;
});

const countValid = computed(() => count.value >= 1 && count.value <= 500);

function clampCount() {
  count.value = Math.min(Math.max(count.value, 1), 500);
}

// Methods
function generate() {
  const safeCount = Math.min(Math.max(count.value, 1), 500);
  results.value = generateUuids(safeCount, version.value, {
    name: nameValue.value,
    namespace: namespaceUuid.value,
  });
  if (enableConversion.value) {
    convertedResults.value = results.value.map((u) => getConvertedUuid(version.value, u));
  } else {
    convertedResults.value = [];
  }
}

const { copy: copySingleItem } = useCopy();
const { copy: copyAllItems } = useCopy();

async function copySingle(uuid: string) {
  await copySingleItem(uuid);
}

async function copyAll() {
  const text = formattedResults.value.join('\n');
  await copyAllItems(text);
}

// Helper: format timestamp for display
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader
      title="UUID 生成器"
      description="生成并解析 UUID v1/v3/v4/v5/v6/v7，支持格式转换与解码分析。"
      :show-example="false"
    />

    <!-- 工具面板 -->
    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <!-- 版本选择 -->
      <SelectListbox
        v-model="version"
        label="UUID 版本"
        :options="VERSION_OPTIONS as any"
      />
      <p class="-mt-3 text-[0.75rem] text-muted leading-relaxed">{{ versionDescription }}</p>

      <!-- V3/V5 命名空间区段 -->
      <template v-if="showNamespace">
        <div class="border-t border-border pt-4 -mx-0">
          <p class="text-[0.8125rem] font-semibold text-text mb-3">命名空间参数</p>
          <div class="flex flex-col gap-3">
            <SelectListbox
              v-model="namespacePreset"
              label="命名空间预设"
              :options="NAMESPACE_PRESET_OPTIONS as any"
            />
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[0.8125rem] text-muted min-w-12 shrink-0">UUID</span>
              <input
                :value="namespaceUuid"
                :readonly="namespacePreset !== 'custom'"
                type="text"
                :class="[
                  'px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[300px]',
                  namespacePreset !== 'custom' ? 'cursor-default text-muted' : '',
                ]"
                placeholder="命名空间 UUID"
              />
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[0.8125rem] text-muted min-w-12 shrink-0">名称</span>
              <input
                v-model="nameValue"
                type="text"
                class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[300px]"
                placeholder="任意字符串"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- v1↔v6 转换 -->
      <ToggleSwitch
        v-if="showConversion"
        v-model="enableConversion"
        :label="`转换${convLabel?.replace('→ ', '') ?? ''}`"
      />

      <!-- 输出格式 -->
      <SelectListbox
        v-model="outputFormat"
        label="输出格式"
        :options="FORMAT_OPTIONS as any"
      />

      <!-- 数量和生成按钮 -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-12 shrink-0">数量</span>
        <input
          v-model.number="count"
          type="number"
          min="1"
          max="500"
          :class="[
            'px-2 py-1 border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[128px]',
            countValid ? 'border-border' : 'border-error',
          ]"
          @blur="clampCount"
        />
        <span class="text-[0.8125rem]" :class="countValid ? 'text-muted' : 'text-error'">条（1-500）</span>
      </div>

      <div class="flex gap-2">
        <button
          class="px-4 py-2 bg-accent border border-accent text-white rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90"
          @click="generate"
        >
          生成
        </button>
      </div>
    </div>

    <!-- 结果区 -->
    <div class="border border-border rounded-md bg-card mt-4 min-h-30">
      <div
        v-if="results.length === 0"
        class="flex items-center justify-center h-30 text-muted text-sm"
      >
        点击「生成」按钮查看结果
      </div>
      <template v-else>
        <div
          class="flex justify-between items-center px-4 py-2 border-b border-border sticky top-0 bg-card rounded-t-md z-1"
        >
          <span class="text-xs text-muted">共 {{ results.length }} 条</span>
          <button
            class="px-2 py-1 bg-surface border border-border text-text rounded-sm text-xs font-sans cursor-pointer hover:bg-hover hover:border-accent"
            @click="copyAll"
          >
            复制全部
          </button>
        </div>
        <div class="max-h-100 overflow-y-auto px-4 py-2 flex flex-col gap-1">
          <div
            v-for="(uuid, i) in formattedResults"
            :key="i"
            class="flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer hover:bg-hover transition-colors duration-150"
            @click="copySingle(uuid)"
          >
            <span class="text-xs text-muted min-w-[24px] text-right shrink-0">{{ i + 1 }}</span>
            <code class="flex-1 text-[0.8125rem] text-text break-all">
              {{ uuid }}
              <template v-if="enableConversion && formattedConverted[i]">
                <span class="text-accent mx-1">→</span>
                {{ formattedConverted[i] }}
              </template>
            </code>
          </div>
        </div>
      </template>
    </div>

    <!-- UUID 解码 / 校验面板 -->
    <div class="border border-border rounded-md p-6 bg-card mt-4 flex flex-col gap-4">
      <h2 class="text-[0.9375rem] font-semibold text-text m-0">UUID 解码 / 校验</h2>
      <input
        v-model="decodeInput"
        type="text"
        class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-full"
        placeholder="粘贴 UUID 进行解析..."
      />

      <!-- 解码结果 -->
      <div
        v-if="decodeResult"
        class="border border-border rounded-sm bg-surface px-3 py-2.5 flex flex-col gap-1.5"
      >
        <!-- 无效提示 -->
        <div v-if="!decodeResult.valid" class="flex items-center gap-2">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-error shrink-0" />
          <span class="text-[0.8125rem] text-error font-semibold">无效 UUID</span>
          <span v-if="decodeResult.note" class="text-[0.8125rem] text-muted">{{ decodeResult.note }}</span>
        </div>

        <!-- 有效 UUID 详情 -->
        <template v-if="decodeResult.valid">
          <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <template v-if="decodeResult.version !== null">
              <span class="text-[0.8125rem] text-muted">版本</span>
              <span class="text-[0.8125rem] text-text font-mono">v{{ decodeResult.version }}</span>
            </template>

            <template v-if="decodeResult.variant">
              <span class="text-[0.8125rem] text-muted">变体</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ decodeResult.variant }}</span>
            </template>

            <template v-if="decodeResult.hashType">
              <span class="text-[0.8125rem] text-muted">哈希算法</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ decodeResult.hashType }}</span>
            </template>

            <template v-if="decodeResult.timestamp">
              <span class="text-[0.8125rem] text-muted">时间戳</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ formatTimestamp(decodeResult.timestamp) }}</span>
            </template>

            <template v-if="decodeResult.unixTimestampMs !== null">
              <span class="text-[0.8125rem] text-muted">Unix 毫秒</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ decodeResult.unixTimestampMs }}</span>
            </template>

            <template v-if="decodeResult.clockSequence !== null">
              <span class="text-[0.8125rem] text-muted">时钟序列</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ decodeResult.clockSequence }}</span>
            </template>

            <template v-if="decodeResult.node">
              <span class="text-[0.8125rem] text-muted">节点/MAC</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ decodeResult.node }}</span>
            </template>

            <template v-if="decodeResult.note">
              <span class="text-[0.8125rem] text-muted">备注</span>
              <span class="text-[0.8125rem] text-text font-mono">{{ decodeResult.note }}</span>
            </template>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
