<script setup lang="ts">
/**
 * 左栏控制面板（本工具私有）：部署模式、硬件画像、使用场景、持久化策略、
 * 目标版本、并发预估与访问密码（requirepass）的快速配置输入区。直接修改传入的
 * reactive ctx 属性（私有组件约定：ctx 由父组件持有，仅属性级变更，不整体替换）。
 */
import { computed } from 'vue';
import type { GenerateContext } from '../params';
import { VERSION_OPTIONS } from '../version';
import { generatePassword } from '../secret';
import CopyButton from '../../../../components/ui/CopyButton.vue';
import OptionRadioGroup from '../../../../components/ui/OptionRadioGroup.vue';
import NumberField from './NumberField.vue';

const props = defineProps<{
  /** 生成上下文（reactive，直接改属性） */
  ctx: GenerateContext;
}>();

const emit = defineEmits<{
  /** 重置为推荐值（父层清空 overrides） */
  reset: [];
}>();

/** 部署模式选项 */
const MODE_OPTIONS = [
  { value: 'standalone', label: '单机' },
  { value: 'replica', label: '主从' },
];

/** 磁盘类型选项 */
const DISK_OPTIONS = [
  { value: 'hdd', label: 'HDD 机械盘' },
  { value: 'ssd', label: 'SSD' },
  { value: 'nvme', label: 'NVMe SSD' },
];

/** 使用场景选项 */
const SCENARIO_OPTIONS = [
  { value: 'cache', label: '缓存' },
  { value: 'session', label: '会话' },
  { value: 'queue', label: '队列' },
  { value: 'mixed', label: '混合' },
];

/** 持久化策略选项（混合持久化为推荐默认，置于首位；字段名已含"策略"，选项用短标签避免冗余） */
const PERSISTENCE_OPTIONS = [
  { value: 'both', label: 'RDB+AOF（推荐）' },
  { value: 'rdb', label: 'RDB' },
  { value: 'aof', label: 'AOF' },
  { value: 'off', label: '关闭' },
];

/** 监听范围选项（驱动 bind 推荐值；protected-mode 恒为 yes 作无密码兜底） */
const LISTEN_SCOPE_OPTIONS = [
  { value: 'all', label: '所有接口（推荐）' },
  { value: 'loopback', label: '仅本机' },
  { value: 'intranet', label: '仅内网网卡' },
];

/** 各监听范围的联动说明（远程可达性与密码的对应关系） */
const LISTEN_SCOPE_HINTS: Record<GenerateContext['listenScope'], string> = {
  all: '监听所有网卡，远程访问依赖访问密码；记得在防火墙/安全组放行端口',
  loopback: '仅本机可连接（适合与应用同机部署），访问密码可清空',
  intranet: '仅监听指定内网 IP，外部不可达；仍建议保留访问密码',
};

/** 画像数值输入的推荐快捷选项（写死常用档位，避免拖拽） */
const CPU_QUICK_OPTIONS = [2, 4, 8, 16];
const MEMORY_QUICK_OPTIONS = [4, 8, 16, 32, 64];
const CONCURRENCY_QUICK_OPTIONS = [100, 500, 1000, 5000];

/** 主从模式下主库地址必填校验 */
const masterAddrError = computed(
  () => props.ctx.mode === 'replica' && !props.ctx.masterAddr.trim(),
);

/** 仅内网监听时绑定 IP 必填校验 */
const bindIpError = computed(
  () => props.ctx.listenScope === 'intranet' && !props.ctx.bindIp.trim(),
);

/** 端口覆盖值（未设置时展示推荐值 6379，编辑即写入覆盖） */
const port = computed(() => (typeof props.ctx.overrides.port === 'number' ? props.ctx.overrides.port : 6379));

/** ctx 枚举字段赋值（OptionRadioGroup 的宽类型收窄） */
function setMode(v: string | number): void {
  props.ctx.mode = v as GenerateContext['mode'];
}
function setDisk(v: string | number): void {
  props.ctx.diskType = v as GenerateContext['diskType'];
}
function setScenario(v: string | number): void {
  props.ctx.scenario = v as GenerateContext['scenario'];
}
function setPersistence(v: string | number): void {
  props.ctx.persistence = v as GenerateContext['persistence'];
}
function setVersion(v: string | number): void {
  props.ctx.version = v as GenerateContext['version'];
}
function setListenScope(v: string | number): void {
  props.ctx.listenScope = v as GenerateContext['listenScope'];
}

/**
 * 写入端口覆盖值。
 * @param value - 新端口
 */
function setPort(value: number): void {
  props.ctx.overrides.port = value;
}

/** requirepass 覆盖值（主组件挂载时已预生成一次；空串表示不写入 conf） */
const requirepass = computed(() => {
  const value = props.ctx.overrides.requirepass;
  return typeof value === 'string' ? value : '';
});

/**
 * 写入 requirepass 覆盖值。
 * @param value - 新密码（空串则 conf 略过该指令行）
 */
function setRequirepass(value: string): void {
  props.ctx.overrides.requirepass = value;
}
</script>

<template>
  <section class="rounded-lg border border-border bg-card p-4">
    <div class="flex flex-col gap-4">
      <!-- 部署模式 -->
      <OptionRadioGroup
        label="部署模式"
        :options="MODE_OPTIONS"
        :model-value="ctx.mode"
        inline-label
        @update:model-value="setMode"
      />

      <!-- 主库地址（主从模式） -->
      <div v-if="ctx.mode === 'replica'">
        <label for="redis-master-addr" class="mb-1 block text-[0.8125rem] text-muted-foreground">主库地址（必填）</label>
        <input
          id="redis-master-addr"
          v-model="ctx.masterAddr"
          type="text"
          placeholder="如 10.0.0.5 6379"
          :aria-invalid="masterAddrError"
          aria-describedby="redis-master-addr-error"
          class="w-full rounded-sm border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
          :class="masterAddrError ? 'border-error' : 'border-border'"
        />
        <p v-if="masterAddrError" id="redis-master-addr-error" class="mt-1 text-[0.8125rem] text-error">
          主从模式必须填写主库地址与端口
        </p>
      </div>

      <!-- 硬件画像 -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">CPU 核数</p>
          <NumberField
            v-model="ctx.cpuCores"
            :min="1"
            :max="32"
            :step="1"
            unit="核"
            label="CPU 核数"
            :quick-options="CPU_QUICK_OPTIONS.map((value) => ({ value }))"
          />
        </div>
        <div>
          <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">物理内存</p>
          <NumberField
            v-model="ctx.memoryGB"
            :min="1"
            :max="256"
            :step="1"
            unit="GB"
            label="物理内存（GB）"
            :quick-options="MEMORY_QUICK_OPTIONS.map((value) => ({ value }))"
          />
        </div>
      </div>

      <OptionRadioGroup
        label="磁盘类型"
        :options="DISK_OPTIONS"
        :model-value="ctx.diskType"
        @update:model-value="setDisk"
      />

      <!-- 使用场景 / 持久化 -->
      <OptionRadioGroup
        label="使用场景"
        :options="SCENARIO_OPTIONS"
        :model-value="ctx.scenario"
        @update:model-value="setScenario"
      />
      <OptionRadioGroup
        label="持久化策略"
        :options="PERSISTENCE_OPTIONS"
        :model-value="ctx.persistence"
        @update:model-value="setPersistence"
      />

      <!-- 版本（按钮组比下拉直观，6 档一屏可见） -->
      <OptionRadioGroup
        label="目标版本"
        :options="VERSION_OPTIONS"
        :model-value="ctx.version"
        @update:model-value="setVersion"
      />

      <!-- 并发 -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">并发连接数预估</p>
        <NumberField
          v-model="ctx.concurrency"
          :min="50"
          :max="10000"
          :step="50"
          unit="连接"
          label="并发连接数预估"
          :quick-options="CONCURRENCY_QUICK_OPTIONS.map((value) => ({ value }))"
        />
      </div>

      <!-- 监听范围：驱动 bind 推荐值与密码提示 -->
      <div>
        <OptionRadioGroup
          label="监听范围"
          :options="LISTEN_SCOPE_OPTIONS"
          :model-value="ctx.listenScope"
          @update:model-value="setListenScope"
        />
        <p class="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{{ LISTEN_SCOPE_HINTS[ctx.listenScope] }}</p>
        <div v-if="ctx.listenScope === 'intranet'" class="mt-2">
          <label for="redis-bind-ip" class="mb-1 block text-[0.8125rem] text-muted-foreground">内网 IP（必填）</label>
          <input
            id="redis-bind-ip"
            v-model="ctx.bindIp"
            type="text"
            placeholder="如 10.0.0.5"
            :aria-invalid="bindIpError"
            aria-describedby="redis-bind-ip-error"
            class="w-full rounded-sm border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
            :class="bindIpError ? 'border-error' : 'border-border'"
          />
          <p v-if="bindIpError" id="redis-bind-ip-error" class="mt-1 text-[0.8125rem] text-error">
            仅内网监听必须填写绑定 IP
          </p>
        </div>
      </div>

      <!-- 端口：同机多实例或规避默认端口扫描时修改 -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">监听端口</p>
        <NumberField
          :model-value="port"
          :min="1024"
          :max="65535"
          :step="1"
          label="监听端口"
          :quick-options="[{ value: 6379, label: '默认' }, { value: 16379 }]"
          @update:model-value="setPort"
        />
      </div>

      <!-- 访问密码：写入 conf 的 requirepass 行（打开页面已自动生成，此处可改可重新生成） -->
      <div>
        <label for="redis-requirepass" class="mb-1 block text-[0.8125rem] text-muted-foreground">访问密码（requirepass）</label>
        <div class="flex gap-2">
          <input
            id="redis-requirepass"
            :value="requirepass"
            type="text"
            class="w-full min-w-0 rounded-sm border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
            @input="setRequirepass(($event.target as HTMLInputElement).value)"
          />
          <CopyButton v-if="requirepass" :text="requirepass" size="sm" />
          <button
            type="button"
            class="shrink-0 rounded-sm border border-border bg-card px-2.5 text-[0.8125rem] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
            title="本地生成 24 位随机密码（crypto.getRandomValues，不经网络）"
            @click="setRequirepass(generatePassword())"
          >
            生成
          </button>
        </div>
        <p class="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">清空则 conf 不输出密码行；仅浏览器本地生成，不上传。</p>
      </div>

      <!-- 重置 -->
      <div class="flex justify-end border-t border-border pt-3">
        <button
          type="button"
          class="rounded-sm border border-border bg-card px-4 py-1.5 text-[0.8125rem] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
          title="清空全部自定义覆盖值，恢复推荐值"
          @click="emit('reset')"
        >
          重置为推荐值
        </button>
      </div>
    </div>
  </section>
</template>
