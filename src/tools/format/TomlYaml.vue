<script setup lang="ts">
/**
 * TOML ↔ YAML 互转主组件。
 *
 * 左右双栏双向实时同步：左侧 TOML、右侧 YAML。主线程同步，仿 EnvConverter。
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import {
  tomlToYaml,
  yamlToToml,
  EXAMPLE_TOML,
} from '../../utils/format/toml-yaml';

/** YAML 缩进选项 */
const yamlIndentOptions: { value: 2 | 4; label: string }[] = [
  { value: 2, label: '2 空格' },
  { value: 4, label: '4 空格' },
];

/** 左侧：TOML 文本 */
const leftValue = ref(EXAMPLE_TOML);
/** 右侧：YAML 文本 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** YAML 缩进 */
const yamlIndent = ref<2 | 4>(2);
/** 当前转换方向，防止 watch 循环 */
const convertingFrom = ref<'left' | 'right' | null>(null);

/** TOML（左）→ YAML（右） */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = tomlToYaml(leftValue.value, yamlIndent.value);
  if (result.ok) {
    rightValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

/** YAML（右）→ TOML（左） */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    return;
  }
  const result = yamlToToml(rightValue.value);
  if (result.ok) {
    leftValue.value = result.result;
    errorMsg.value = '';
  } else {
    errorMsg.value = result.error;
  }
}

watch(leftValue, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

watch(rightValue, () => {
  if (convertingFrom.value === 'left') return;
  convertingFrom.value = 'right';
  convertRightToLeft();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

watch(yamlIndent, () => {
  if (convertingFrom.value === 'right') return;
  convertingFrom.value = 'left';
  convertLeftToRight();
  nextTick(() => {
    convertingFrom.value = null;
  });
});

function handleClear(): void {
  leftValue.value = '';
  rightValue.value = '';
  errorMsg.value = '';
}

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
      title="TOML 与 YAML 互转"
      description="TOML 与 YAML 双向实时互转，支持 2/4 空格缩进"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <div class="flex items-center gap-2 mr-auto">
          <span class="text-[0.8125rem] text-muted">YAML 缩进</span>
          <div class="inline-flex rounded-sm border border-border overflow-hidden">
            <button
              v-for="opt in yamlIndentOptions"
              :key="opt.value"
              type="button"
              :class="[
                'px-3 py-1.5 text-[0.8125rem] transition-[background-color,color] duration-150 cursor-pointer',
                yamlIndent === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-card text-muted hover:bg-hover hover:text-text',
              ]"
              @click="yamlIndent = opt.value"
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
        <CodePanel label="YAML" show-clear show-copy :copy-text="rightValue" @clear="handleClear">
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="16"
            placeholder="输入 YAML 文本..."
            spellcheck="false"
            aria-label="YAML 输入"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
    </div>
  </div>
</template>
