<script setup lang="ts">
/**
 * Docker 配置转换主组件。
 *
 * 提供左右双输入区：左侧编辑 docker run 命令，右侧实时输出 compose 配置；
 * 右侧编辑 compose 配置，左侧实时输出 docker run 命令。
 * 通过交换按钮可快速互换两侧内容。
 */
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import CodePanel from '../../components/ui/CodePanel.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { convertRunToCompose } from '../../utils/docker/run-to-compose';
import { convertComposeToRun } from '../../utils/docker/compose-to-run';

/** run → compose 默认示例 */
const DEFAULT_RUN_INPUT = 'docker run -d --name my-nginx -p 8080:80 -v /host/path:/usr/share/nginx/html:ro --restart unless-stopped -e NGINX_HOST=example.com nginx:latest';

/** 左侧：docker run 命令 */
const leftValue = ref(DEFAULT_RUN_INPUT);
/** 右侧：docker compose 配置 */
const rightValue = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** 不支持 / 无法映射的项数量 */
const unsupportedCount = ref(0);
/** 当前正在执行转换的方向，用于防止 watch 循环触发 */
const convertingFrom = ref<'left' | 'right' | null>(null);
/** 交换操作标志，用于跳过 watch 触发 */
const isSwapping = ref(false);

/**
 * 将左侧 docker run 转换为右侧 compose。
 */
function convertLeftToRight(): void {
  if (!leftValue.value.trim()) {
    rightValue.value = '';
    errorMsg.value = '';
    unsupportedCount.value = 0;
    return;
  }

  try {
    const result = convertRunToCompose(leftValue.value);
    if (result.ok) {
      rightValue.value = result.result;
      unsupportedCount.value = result.unsupportedCount;
      errorMsg.value = '';
    } else {
      errorMsg.value = result.error;
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '转换失败';
  }
}

/**
 * 将右侧 compose 转换为左侧 docker run。
 */
function convertRightToLeft(): void {
  if (!rightValue.value.trim()) {
    leftValue.value = '';
    errorMsg.value = '';
    unsupportedCount.value = 0;
    return;
  }

  try {
    const result = convertComposeToRun(rightValue.value);
    if (result.ok) {
      leftValue.value = result.result;
      unsupportedCount.value = result.unsupportedCount;
      errorMsg.value = '';
    } else {
      errorMsg.value = result.error;
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '转换失败';
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
  unsupportedCount.value = 0;
}

/** 组件挂载时执行初始转换 */
onMounted(() => {
  convertLeftToRight();
});

/** 不支持提示文案 */
const unsupportedHint = computed(() => unsupportedCount.value > 0
  ? `输出中包含 ${unsupportedCount.value} 个不支持的项，已以注释形式保留`
  : '',
);
</script>

<template>
  <div>
    <ToolHeader
      title="Docker 配置转换"
      description="在 docker run 命令与 docker compose 配置之间互转"
      :show-example="false"
    />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #actions>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-sm bg-card text-muted text-[0.8125rem] cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-hover hover:text-text"
          @click="handleSwap"
        >
          <span>⇄</span>
          <span>交换</span>
        </button>
      </template>

      <template #input>
        <CodePanel
          label="docker run"
          show-clear
          show-copy
          :copy-text="leftValue"
          @clear="handleClear"
        >
          <textarea
            v-model="leftValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="12"
            placeholder="输入 docker run 命令..."
            spellcheck="false"
          ></textarea>
        </CodePanel>
      </template>

      <template #output>
        <CodePanel
          label="docker compose"
          show-clear
          show-copy
          :copy-text="rightValue"
          @clear="handleClear"
        >
          <textarea
            v-model="rightValue"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="12"
            placeholder="输入 docker compose 配置..."
            spellcheck="false"
          ></textarea>
        </CodePanel>
      </template>
    </ResponsiveWorkspace>

    <div class="mx-auto w-full max-w-[1600px] mt-4 text-center">
      <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0">{{ errorMsg }}</p>
      <p v-if="unsupportedHint" class="text-[0.75rem] text-muted m-0 mt-1">{{ unsupportedHint }}</p>
    </div>
  </div>
</template>
