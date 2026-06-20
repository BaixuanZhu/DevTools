<script setup lang="ts">
/**
 * 环境变量转换主组件。
 *
 * 提供左右双输入区：左侧编辑 .env 文本，右侧实时输出 JSON；
 * 右侧编辑 JSON，左侧实时输出 .env 文本。
 * 通过交换按钮可快速互换两侧内容。
 */
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { useCopy } from '../../composables/useCopy';
import {
  envTextToJson,
  jsonToEnvText,
  type EnvDiagnostics,
} from '../../utils/devops/env-converter';

/** .env 默认示例 */
const DEFAULT_ENV_INPUT = `# 应用配置
APP_NAME=MyApp
DB_USER=admin
DATABASE_URL="postgres://user:${DB_USER}@host"
export PORT=3000
GREETING="Hello\\nWorld"
EMPTY=""`;

/** 左侧：.env 文本 */
const leftValue = ref(DEFAULT_ENV_INPUT);
/** 右侧：JSON 文本 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** .env → JSON 的诊断信息 */
const diagnostics = ref<EnvDiagnostics | null>(null);
/** JSON 输出缩进：2 美化 / 0 紧凑 */
const jsonIndent = ref<2 | 0>(2);
/** 当前正在执行转换的方向，用于防止 watch 循环触发 */
const convertingFrom = ref<'left' | 'right' | null>(null);
/** 交换操作标志，用于跳过 watch 触发 */
const isSwapping = ref(false);

const { copy } = useCopy();

/**
 * 将左侧 .env 转换为右侧 JSON。
 */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    diagnostics.value = null;
    return;
  }

  const result = envTextToJson(leftValue.value, jsonIndent.value);
  if (result.ok) {
    rightValue.value = result.result;
    diagnostics.value = result.diagnostics;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/**
 * 将右侧 JSON 转换为左侧 .env。
 */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    diagnostics.value = null;
    return;
  }

  const result = jsonToEnvText(rightValue.value);
  if (result.ok) {
    leftValue.value = result.result;
    diagnostics.value = null;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** 监听左侧变化 */
watch(leftValue, () => {
  if (isSwapping.value || convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  convertingFrom.value = null;
});

/** 监听右侧变化 */
watch(rightValue, () => {
  if (isSwapping.value || convertingFrom.value === 'left') return;
  convertingFrom.value = 'right';
  convertRightToLeft();
  convertingFrom.value = null;
});

/** 监听 JSON 缩进变化，重新生成右侧 */
watch(jsonIndent, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  convertingFrom.value = null;
});

/**
 * 交换两侧内容。
 * 交换时不触发自动转换，由用户后续编辑触发。
 */
function handleSwap(): void {
  isSwapping.value = true;
  const temp = leftValue.value;
  leftValue.value = rightValue.value;
  rightValue.value = temp;
  nextTick(() => {
    isSwapping.value = false;
  });
}

/**
 * 清空两侧输入和错误状态。
 */
function handleClear(): void {
  leftValue.value = '';
  rightValue.value = '';
  errorMsg.value = '';
  diagnostics.value = null;
}

/** 组件挂载时执行初始转换 */
onMounted(() => {
  convertLeftToRight();
});

/** 诊断提示文案 */
const diagnosticsHint = computed(() => {
  if (!diagnostics.value) return '';
  const parts: string[] = [];
  if (diagnostics.value.droppedComments > 0) {
    parts.push(`已丢弃 ${diagnostics.value.droppedComments} 条注释`);
  }
  if (diagnostics.value.overwrittenKeys > 0) {
    parts.push(`覆盖 ${diagnostics.value.overwrittenKeys} 个重复键`);
  }
  return parts.join(' · ');
});
</script>

<template>
  <div>
    <ToolHeader
      title="环境变量转换"
      description=".env 配置与 JSON 双向互转，支持引号、转义与同文件变量插值"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1.5 text-[0.8125rem] text-muted cursor-pointer">
            <span>JSON 格式</span>
            <select
              v-model.number="jsonIndent"
              class="px-2 py-1 border border-border rounded-sm bg-card text-text text-[0.8125rem] outline-none focus:border-accent cursor-pointer"
              aria-label="JSON 输出格式"
            >
              <option :value="2">美化</option>
              <option :value="0">紧凑</option>
            </select>
          </label>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm bg-card text-muted text-[0.8125rem] cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
            @click="handleSwap"
          >
            <span>⇄</span>
            <span>交换</span>
          </button>
        </div>
      </template>

      <template #input>
        <CodePanel
          label=".env"
          show-clear
          show-copy
          :copy-text="leftValue"
          @clear="handleClear"
        >
          <textarea
            v-model="leftValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="14"
            placeholder="输入 .env 文本..."
            spellcheck="false"
          ></textarea>
        </CodePanel>
      </template>

      <template #output>
        <CodePanel
          label="JSON"
          show-clear
          show-copy
          :copy-text="rightValue"
          @clear="handleClear"
        >
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="14"
            placeholder="输入 JSON 文本..."
            spellcheck="false"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
      <p v-if="diagnosticsHint" class="text-[0.75rem] text-muted m-0 mt-1">{{ diagnosticsHint }}</p>
    </div>
  </div>
</template>
