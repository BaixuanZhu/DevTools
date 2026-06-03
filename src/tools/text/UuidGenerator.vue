<script setup lang="ts">
import { ref, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import OptionRadioGroup from '../../components/ui/OptionRadioGroup.vue';
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue';
import type { UuidVersion } from '../../utils/text/uuid-generator';
import {
  generateUuids,
  getConvertedUuid,
  getConversionLabel,
  hasConversion,
  isNamespaceVersion,
} from '../../utils/text/uuid-generator';

const version = ref<UuidVersion>('v4');
const nameValue = ref('');
const namespaceUuid = ref('');
const count = ref(1);
const enableConversion = ref(false);
const results = ref<string[]>([]);
const convertedResults = ref<(string | null)[]>([]);

const showNamespace = computed(() => isNamespaceVersion(version.value));
const showConversion = computed(() => hasConversion(version.value));
const convLabel = computed(() => getConversionLabel(version.value));

function generate() {
  const safeCount = Math.min(Math.max(count.value, 1), 500);
  results.value = generateUuids(safeCount, version.value, { name: nameValue.value, namespace: namespaceUuid.value });
  if (enableConversion.value) {
    convertedResults.value = results.value.map((u) => getConvertedUuid(version.value, u));
  } else {
    convertedResults.value = [];
  }
}

function showToast(message: string) {
  document.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message } }));
}

async function copySingle(uuid: string) {
  try { await navigator.clipboard.writeText(uuid); showToast('已复制'); } catch {}
}

async function copyAll() {
  const text = results.value.join('\n');
  try { await navigator.clipboard.writeText(text); showToast('已复制'); } catch {}
}

function onVersionChange(_ver: UuidVersion) {
  enableConversion.value = false;
}
</script>

<template>
  <div class="max-w-[720px]">
    <ToolHeader title="UUID 生成器" description="在线生成 UUID v1/v3/v4/v5/v6/v7，支持批量生成及 v1↔v6 相互转换。" @example="generate" />

    <div class="border border-border rounded-md p-6 bg-card flex flex-col gap-4">
      <OptionRadioGroup
        v-model="version"
        label="版本"
        :options="[
          { value: 'v1', label: 'V1' },
          { value: 'v3', label: 'V3' },
          { value: 'v4', label: 'V4' },
          { value: 'v5', label: 'V5' },
          { value: 'v6', label: 'V6' },
          { value: 'v7', label: 'V7' },
        ]"
        @update:model-value="onVersionChange"
      />

      <ToggleSwitch
        v-if="showConversion"
        v-model="enableConversion"
        :label="`转${convLabel?.replace('→ ', '') ?? ''}`"
      />

      <template v-if="showNamespace">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[0.8125rem] text-muted min-w-[48px] shrink-0">名称</span>
          <input v-model="nameValue" type="text" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent" placeholder="任意字符串" />
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[0.8125rem] text-muted min-w-[48px] shrink-0">命名空间</span>
          <input v-model="namespaceUuid" type="text" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[260px]" placeholder="命名空间 UUID" />
        </div>
      </template>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[0.8125rem] text-muted min-w-[48px] shrink-0">数量</span>
        <input v-model.number="count" type="number" min="1" max="500" class="px-2 py-1 border border-border rounded-sm bg-surface text-text text-[0.8125rem] font-mono outline-none focus:border-accent w-[64px]" />
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
          <div v-for="(uuid, i) in results" :key="i" class="flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer hover:bg-hover transition-colors duration-150" @click="copySingle(uuid)">
            <span class="text-xs text-muted min-w-[28px] text-right shrink-0">{{ i + 1 }}</span>
            <code class="flex-1 text-[0.8125rem] text-text break-all">
              {{ uuid }}
              <template v-if="enableConversion && convertedResults[i]">
                <span class="text-accent mx-1">→</span>
                {{ convertedResults[i] }}
              </template>
            </code>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
