<script setup lang="ts">
/**
 * TOML ↔ JSON 互转主组件。
 *
 * 左右双栏双向实时同步：左侧编辑 TOML → 右侧实时输出 JSON；
 * 右侧编辑 JSON → 左侧实时输出 TOML。主线程同步，仿 EnvConverter。
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import {
  tomlToJson,
  jsonToToml,
  EXAMPLE_TOML,
} from '../../utils/format/toml-json';

/** JSON 输出格式选项 */
const jsonFormatOptions: { value: boolean; label: string }[] = [
  { value: true, label: '美化' },
  { value: false, label: '紧凑' },
];

/** 左侧：TOML 文本 */
const leftValue = ref(EXAMPLE_TOML);
/** 右侧：JSON 文本 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** JSON 输出美化开关 */
const jsonPretty = ref(true);
/** 当前转换方向，防止 watch 循环 */
const convertingFrom = ref<'left' | 'right' | null>(null);

/** TOML（左）→ JSON（右） */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = tomlToJson(leftValue.value, jsonPretty.value);
  if (result.ok) {
    rightValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** JSON（右）→ TOML（左） */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = jsonToToml(rightValue.value);
  if (result.ok) {
    leftValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** 监听左侧（TOML）变化 */
watch(leftValue, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

/** 监听右侧（JSON）变化 */
watch(rightValue, () => {
  if (convertingFrom.value === 'left') return;
  convertingFrom.value = 'right';
  convertRightToLeft();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

/** JSON 格式变化时重新生成右侧 */
watch(jsonPretty, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

/** 清空两侧 */
function handleClear(): void {
  leftValue.value = '';
  rightValue.value = '';
  errorMsg.value = '';
}

/** 挂载时执行初始转换（设标志避免初始 rightValue 变化触发反向回写） */
onMounted(() => {
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});
</script>

<template>
  <div>
    <ToolHeader
      title="TOML 与 JSON 互转"
      description="TOML 与 JSON 双向实时互转，支持美化与紧凑输出"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <div class="flex items-center gap-2 mr-auto">
          <span class="text-[0.8125rem] text-muted">JSON 格式</span>
          <div class="inline-flex rounded-sm border border-border overflow-hidden">
            <button
              v-for="opt in jsonFormatOptions"
              :key="opt.label"
              type="button"
              :class="[
                'px-3 py-1.5 text-[0.8125rem] transition-[background-color,color] duration-150 cursor-pointer',
                jsonPretty === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-card text-muted hover:bg-hover hover:text-text',
              ]"
              @click="jsonPretty = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </template>

      <template #input>
        <CodePanel label="TOML" show-clear show-copy :copy-text="leftValue" @clear="handleClear">
          <textarea
            v-model="leftValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 TOML 文本..."
            spellcheck="false"
            aria-label="TOML 输入"
          ></textarea>
        </CodePanel>
      </template>

      <template #output>
        <CodePanel label="JSON" show-clear show-copy :copy-text="rightValue" @clear="handleClear">
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 JSON 文本..."
            spellcheck="false"
            aria-label="JSON 输入"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
    </div>
  </div>
</template>
