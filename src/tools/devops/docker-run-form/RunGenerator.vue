<script setup lang="ts">
/**
 * docker run 命令生成器组件。
 *
 * 提供表单配置容器运行参数，实时生成并展示可复制的 docker run 命令。
 */
import { ref, computed, watch } from 'vue';
import ToolHeader from '../../../components/layout/ToolHeader.vue';
import CodePanel from '../../../components/ui/CodePanel.vue';
import SelectListbox from '../../../components/ui/SelectListbox.vue';
import ToggleSwitch from '../../../components/ui/ToggleSwitch.vue';
import {
  generateDockerRunCommand,
  type FormState,
} from '../../../utils/docker/generate-run-command';

/** 默认示例状态 */
const EXAMPLE_STATE: FormState = {
  image: 'nginx',
  tag: 'latest',
  name: 'my-nginx',
  ports: [{ host: '8080', container: '80', protocol: 'tcp' }],
  envs: [{ key: 'NGINX_HOST', value: 'example.com' }],
  volumes: [{ host: '/host/html', container: '/usr/share/nginx/html', mode: 'ro' }],
  workdir: '',
  restart: 'unless-stopped',
  network: 'bridge',
  detach: true,
  interactive: false,
  tty: false,
  rm: false,
  extraArgs: '',
};

/** 表单初始空状态 */
const EMPTY_STATE: FormState = {
  image: '',
  tag: '',
  name: '',
  ports: [{ host: '', container: '', protocol: 'tcp' }],
  envs: [{ key: '', value: '' }],
  volumes: [{ host: '', container: '', mode: '' }],
  workdir: '',
  restart: '',
  network: '',
  detach: false,
  interactive: false,
  tty: false,
  rm: false,
  extraArgs: '',
};

/** 当前表单状态 */
const formState = ref<FormState>({ ...EMPTY_STATE });

/** 自增 ID 计数器，用于动态行的唯一 key */
let idCounter = 0;

/** 为端口、环境变量、卷挂载行分配唯一 ID */
interface IdentifiedPort { id: number; host: string; container: string; protocol: 'tcp' | 'udp'; }
interface IdentifiedEnv { id: number; key: string; value: string; }
interface IdentifiedVolume { id: number; host: string; container: string; mode: '' | 'ro' | 'rw'; }

/** 包装后的端口列表 */
const identifiedPorts = ref<IdentifiedPort[]>([{ id: ++idCounter, host: '', container: '', protocol: 'tcp' }]);
/** 包装后的环境变量列表 */
const identifiedEnvs = ref<IdentifiedEnv[]>([{ id: ++idCounter, key: '', value: '' }]);
/** 包装后的卷挂载列表 */
const identifiedVolumes = ref<IdentifiedVolume[]>([{ id: ++idCounter, host: '', container: '', mode: '' }]);

/** 同步 identified 列表到 formState */
function syncToFormState() {
  formState.value.ports = identifiedPorts.value.map(({ host, container, protocol }) => ({ host, container, protocol }));
  formState.value.envs = identifiedEnvs.value.map(({ key, value }) => ({ key, value }));
  formState.value.volumes = identifiedVolumes.value.map(({ host, container, mode }) => ({ host, container, mode }));
}

/** 从 formState 同步到 identified 列表（用于填入示例） */
function syncFromFormState() {
  identifiedPorts.value = formState.value.ports.map((p) => ({ ...p, id: ++idCounter }));
  identifiedEnvs.value = formState.value.envs.map((e) => ({ ...e, id: ++idCounter }));
  identifiedVolumes.value = formState.value.volumes.map((v) => ({ ...v, id: ++idCounter }));
}

/** 生成的命令 */
const command = computed(() => {
  syncToFormState();
  return generateDockerRunCommand(formState.value);
});

/** 是否显示空状态提示 */
const showEmptyHint = computed(() => !formState.value.image.trim());

/** 重启策略选项 */
const restartOptions = [
  { value: '', label: '不设置' },
  { value: 'no', label: 'no' },
  { value: 'always', label: 'always' },
  { value: 'unless-stopped', label: 'unless-stopped' },
  { value: 'on-failure', label: 'on-failure' },
];

/** 网络模式选项 */
const networkOptions = [
  { value: '', label: '不设置' },
  { value: 'bridge', label: 'bridge' },
  { value: 'host', label: 'host' },
  { value: 'none', label: 'none' },
];

/** 协议选项 */
const protocolOptions = [
  { value: 'tcp', label: 'tcp' },
  { value: 'udp', label: 'udp' },
];

/** 卷模式选项 */
const volumeModeOptions = [
  { value: '', label: '默认' },
  { value: 'ro', label: 'ro' },
  { value: 'rw', label: 'rw' },
];

/**
 * 添加一行端口映射。
 */
function addPort() {
  identifiedPorts.value.push({ id: ++idCounter, host: '', container: '', protocol: 'tcp' });
}

/**
 * 删除指定端口映射行。
 */
function removePort(id: number) {
  const index = identifiedPorts.value.findIndex((p) => p.id === id);
  if (index !== -1) {
    identifiedPorts.value.splice(index, 1);
  }
  if (identifiedPorts.value.length === 0) {
    addPort();
  }
}

/**
 * 添加一行环境变量。
 */
function addEnv() {
  identifiedEnvs.value.push({ id: ++idCounter, key: '', value: '' });
}

/**
 * 删除指定环境变量行。
 */
function removeEnv(id: number) {
  const index = identifiedEnvs.value.findIndex((e) => e.id === id);
  if (index !== -1) {
    identifiedEnvs.value.splice(index, 1);
  }
  if (identifiedEnvs.value.length === 0) {
    addEnv();
  }
}

/**
 * 添加一行卷挂载。
 */
function addVolume() {
  identifiedVolumes.value.push({ id: ++idCounter, host: '', container: '', mode: '' });
}

/**
 * 删除指定卷挂载行。
 */
function removeVolume(id: number) {
  const index = identifiedVolumes.value.findIndex((v) => v.id === id);
  if (index !== -1) {
    identifiedVolumes.value.splice(index, 1);
  }
  if (identifiedVolumes.value.length === 0) {
    addVolume();
  }
}

/**
 * 清空表单。
 */
function handleClear() {
  formState.value = { ...EMPTY_STATE };
  identifiedPorts.value = [{ id: ++idCounter, host: '', container: '', protocol: 'tcp' }];
  identifiedEnvs.value = [{ id: ++idCounter, key: '', value: '' }];
  identifiedVolumes.value = [{ id: ++idCounter, host: '', container: '', mode: '' }];
}

/**
 * 填入示例。
 */
function handleExample() {
  formState.value = JSON.parse(JSON.stringify(EXAMPLE_STATE));
  syncFromFormState();
}

/** 监听 interactive 与 tty，自动联动为 -it / -i / -t */
watch(
  () => formState.value.interactive,
  (val) => {
    formState.value.tty = val;
  },
);
</script>

<template>
  <div class="w-full">
    <ToolHeader
      title="Docker Run 命令助手"
      description="填写参数，实时生成可复制的 docker run 命令"
      @example="handleExample"
    />

    <!-- 表单区 -->
    <div class="flex flex-col gap-4 mb-6">
      <!-- 镜像与名称 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">镜像名称 *</label>
          <input
            v-model="formState.image"
            type="text"
            placeholder="如 nginx"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">标签</label>
          <input
            v-model="formState.tag"
            type="text"
            placeholder="latest"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">容器名称 --name</label>
          <input
            v-model="formState.name"
            type="text"
            placeholder="my-container"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
        <div>
          <label class="block mb-1 text-[0.8125rem] text-muted">工作目录 -w</label>
          <input
            v-model="formState.workdir"
            type="text"
            placeholder="/app"
            class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
          />
        </div>
      </div>

      <!-- 下拉选项 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectListbox
          v-model="formState.restart"
          label="重启策略 --restart"
          :options="restartOptions"
        />
        <SelectListbox
          v-model="formState.network"
          label="网络模式 --network"
          :options="networkOptions"
        />
      </div>

      <!-- 开关 -->
      <div class="flex flex-wrap gap-6">
        <ToggleSwitch v-model="formState.detach" label="后台运行" description="-d" />
        <ToggleSwitch v-model="formState.rm" label="自动删除" description="--rm" />
        <ToggleSwitch v-model="formState.interactive" label="交互终端" description="-i" />
      </div>

      <!-- 端口映射 -->
      <div>
        <label class="block mb-2 text-[0.8125rem] text-muted">端口映射 -p</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="port in identifiedPorts"
            :key="port.id"
            class="flex items-center gap-2"
          >
            <input
              v-model="port.host"
              type="text"
              placeholder="主机端口"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <span class="text-muted">:</span>
            <input
              v-model="port.container"
              type="text"
              placeholder="容器端口"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <SelectListbox
              v-model="port.protocol"
              :options="protocolOptions"
              class="w-24"
            />
            <button
              type="button"
              class="px-2 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              @click="removePort(port.id)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
          @click="addPort"
        >
          + 添加端口
        </button>
      </div>

      <!-- 环境变量 -->
      <div>
        <label class="block mb-2 text-[0.8125rem] text-muted">环境变量 -e</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="env in identifiedEnvs"
            :key="env.id"
            class="flex items-center gap-2"
          >
            <input
              v-model="env.key"
              type="text"
              placeholder="KEY"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <span class="text-muted">=</span>
            <input
              v-model="env.value"
              type="text"
              placeholder="value"
              class="flex-[2] min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <button
              type="button"
              class="px-2 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              @click="removeEnv(env.id)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
          @click="addEnv"
        >
          + 添加环境变量
        </button>
      </div>

      <!-- 挂载卷 -->
      <div>
        <label class="block mb-2 text-[0.8125rem] text-muted">挂载卷 -v</label>
        <div class="flex flex-col gap-2">
          <div
            v-for="vol in identifiedVolumes"
            :key="vol.id"
            class="flex items-center gap-2"
          >
            <input
              v-model="vol.host"
              type="text"
              placeholder="主机路径"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <span class="text-muted">:</span>
            <input
              v-model="vol.container"
              type="text"
              placeholder="容器路径"
              class="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
            />
            <SelectListbox
              v-model="vol.mode"
              :options="volumeModeOptions"
              class="w-24"
            />
            <button
              type="button"
              class="px-2 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
              @click="removeVolume(vol.id)"
            >
              删除
            </button>
          </div>
        </div>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 text-[0.8125rem] text-muted border border-border rounded-sm bg-card hover:bg-hover hover:text-text transition-[background-color,color] duration-150"
          @click="addVolume"
        >
          + 添加挂载卷
        </button>
      </div>

      <!-- 额外参数 -->
      <div>
        <label class="block mb-1 text-[0.8125rem] text-muted">镜像后的额外参数</label>
        <input
          v-model="formState.extraArgs"
          type="text"
          placeholder="如 bash 或 nginx -g 'daemon off;'"
          class="w-full px-4 py-2 border border-border rounded-sm bg-card text-text text-sm font-sans outline-none transition-[border-color] duration-150 focus:border-accent"
        />
      </div>
    </div>

    <!-- 命令输出区 -->
    <CodePanel
      label="生成的命令"
      show-copy
      show-clear
      :copy-text="command"
      @clear="handleClear"
    >
      <div class="px-4 py-3 min-h-24">
        <pre
          v-if="!showEmptyHint"
          class="m-0 font-mono text-sm text-text whitespace-pre-wrap break-all"
        >{{ command }}</pre>
        <p
          v-else
          class="m-0 text-[0.8125rem] text-muted"
        >
          请输入镜像名称以生成命令
        </p>
      </div>
    </CodePanel>
  </div>
</template>
