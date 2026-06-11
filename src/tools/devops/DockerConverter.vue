<script setup lang="ts">
/**
 * Docker Run ↔ Compose 转换器主组件。
 *
 * 提供双 Tab 界面：run → compose 与 compose → run。
 * 点击「转换」按钮触发转换，输出为只读 textarea 并提供复制。
 */
import { ref, watch, computed } from 'vue';
import ToolHeader from '../../components/layout/ToolHeader.vue';
import ModeTabGroup from '../../components/ui/ModeTabGroup.vue';
import CopyButton from '../../components/ui/CopyButton.vue';
import ClearButton from '../../components/ui/ClearButton.vue';
import ResponsiveWorkspace from '../../components/layout/ResponsiveWorkspace.vue';
import { convertRunToCompose } from '../../utils/docker/run-to-compose';
import { convertComposeToRun } from '../../utils/docker/compose-to-run';

type Mode = 'run-to-compose' | 'compose-to-run';

const MODE_OPTIONS = [
  { key: 'run-to-compose', label: 'run → compose' },
  { key: 'compose-to-run', label: 'compose → run' },
];

/** run → compose 默认示例 */
const DEFAULT_RUN_INPUT = 'docker run -d --name my-nginx -p 8080:80 -v /host/path:/usr/share/nginx/html:ro --restart unless-stopped -e NGINX_HOST=example.com nginx:latest';

/** compose → run 默认示例 */
const DEFAULT_COMPOSE_INPUT = `services:
  my-nginx:
    image: nginx:latest
    container_name: my-nginx
    ports:
      - "8080:80"
    volumes:
      - /host/path:/usr/share/nginx/html:ro
    environment:
      NGINX_HOST: example.com
    restart: unless-stopped
`;

/** 当前模式 */
const mode = ref<Mode>('run-to-compose');
/** 输入内容 */
const input = ref(DEFAULT_RUN_INPUT);
/** 转换输出 */
const output = ref('');
/** 错误提示 */
const errorMsg = ref('');
/** 不支持/无法映射的项数量 */
const unsupportedCount = ref(0);

/**
 * 执行转换。
 */
function handleConvert(): void {
  errorMsg.value = '';
  output.value = '';
  unsupportedCount.value = 0;

  if (!input.value.trim()) {
    errorMsg.value = mode.value === 'run-to-compose'
      ? '请输入 docker run 命令'
      : '请输入 docker compose 配置';
    return;
  }

  const result = mode.value === 'run-to-compose'
    ? convertRunToCompose(input.value)
    : convertComposeToRun(input.value);

  if (!result.ok) {
    errorMsg.value = result.error;
    return;
  }

  output.value = result.result;
  unsupportedCount.value = result.unsupportedCount;
}

/**
 * 清空输入、输出和错误状态。
 */
function handleClear(): void {
  input.value = '';
  output.value = '';
  errorMsg.value = '';
  unsupportedCount.value = 0;
}

/**
 * 填入当前模式的默认示例。
 */
function fillExample(): void {
  input.value = mode.value === 'run-to-compose' ? DEFAULT_RUN_INPUT : DEFAULT_COMPOSE_INPUT;
  output.value = '';
  errorMsg.value = '';
  unsupportedCount.value = 0;
}

/**
 * 切换模式时重置为对应默认值。
 */
watch(mode, () => {
  input.value = mode.value === 'run-to-compose' ? DEFAULT_RUN_INPUT : DEFAULT_COMPOSE_INPUT;
  output.value = '';
  errorMsg.value = '';
  unsupportedCount.value = 0;
});

/** 输入区标签 */
const inputLabel = computed(() =>
  mode.value === 'run-to-compose' ? 'docker run 命令' : 'docker compose 配置',
);

/** 输出区标签 */
const outputLabel = computed(() =>
  mode.value === 'run-to-compose' ? 'docker-compose.yml' : 'docker run 命令',
);

/** 转换按钮文案 */
const convertLabel = computed(() =>
  mode.value === 'run-to-compose' ? '转换为 Compose' : '转换为 Run',
);

/** 不支持提示文案 */
const unsupportedHint = computed(() => unsupportedCount.value > 0
  ? `输出中包含 ${unsupportedCount.value} 个不支持的项，已以注释形式保留`
  : '',
);
</script>

<template>
  <div>
    <ToolHeader
      title="Docker Run ↔ Compose 转换器"
      description="在 docker run 命令与 docker compose 配置之间互转"
      @example="fillExample"
    />

    <ModeTabGroup v-model="mode" :options="MODE_OPTIONS" />

    <ResponsiveWorkspace mode="horizontal" gap="gap-4">
      <template #input>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">{{ inputLabel }}</label>
          <textarea
            v-model="input"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-card resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            :placeholder="mode === 'run-to-compose' ? '输入 docker run 命令...' : '粘贴 docker-compose.yml...'"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="flex gap-2 items-center">
          <button
            class="px-4 py-2 bg-accent text-white border border-accent rounded-sm text-[0.8125rem] font-sans cursor-pointer hover:opacity-90 transition-[opacity] duration-150"
            @click="handleConvert"
          >
            {{ convertLabel }}
          </button>
          <ClearButton @clear="handleClear" />
        </div>

        <p v-if="errorMsg" class="text-error text-[0.8125rem] m-0 mt-3">{{ errorMsg }}</p>
      </template>

      <template #output>
        <div class="mb-3">
          <label class="block text-[0.8125rem] text-muted font-medium mb-1">{{ outputLabel }}</label>
          <textarea
            v-model="output"
            class="w-full px-4 py-2 border border-border rounded-sm text-sm font-mono text-text bg-hover resize-y box-border focus:outline-none focus:border-accent"
            rows="8"
            readonly
            :placeholder="output ? '' : '点击「转换」查看结果'"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="flex flex-wrap gap-2 items-center justify-between">
          <CopyButton :text="output" label="复制结果" />
          <span v-if="unsupportedHint" class="text-[0.75rem] text-muted">{{ unsupportedHint }}</span>
        </div>
      </template>
    </ResponsiveWorkspace>
  </div>
</template>
