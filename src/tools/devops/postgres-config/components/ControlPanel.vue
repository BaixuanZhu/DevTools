<script setup lang="ts">
/**
 * 左栏控制面板（本工具私有）：部署模式、目标版本、硬件画像（内存/CPU/磁盘）、
 * 使用场景、并发预估、监听范围与端口的快速配置输入区。直接修改传入的
 * reactive ctx 属性（私有组件约定：ctx 由父组件持有，仅属性级变更，不整体替换）。
 *
 * 与 MySQL 版的差异：恢复 CPU 核数输入（并行组三项公式的消费方）；内网绑定 IP
 * 在"必填"之上增加 IPv4 格式校验（中文错误提示）；无密码/账号输入——PG 口令属
 * pg_hba.conf 与 SQL 层（ALTER ROLE），见 FAQ 与产物头注释。
 */
import { computed } from 'vue';
import type { GenerateContext } from '../params';
import { SCENARIO_LABELS } from '../params';
import { TARGET_VERSIONS } from '../version';
import OptionRadioGroup from '../../../../components/ui/OptionRadioGroup.vue';
import NumberField from '../../../../components/config/NumberField.vue';

const props = defineProps<{
  /** 生成上下文（reactive，直接改属性） */
  ctx: GenerateContext;
}>();

const emit = defineEmits<{
  /** 重置为推荐值（父层清空 overrides，画像字段保留联动） */
  reset: [];
}>();

/** 部署模式选项 */
const MODE_OPTIONS = [
  { value: 'single', label: '单机' },
  { value: 'replica', label: '主从' },
];

/** 磁盘类型选项 */
const DISK_OPTIONS = [
  { value: 'hdd', label: 'HDD 机械盘' },
  { value: 'ssd', label: 'SSD' },
  { value: 'nvme', label: 'NVMe SSD' },
];

/** 使用场景选项（label 与 conf 头部注释共用 SCENARIO_LABELS，保证口径一致） */
const SCENARIO_OPTIONS = (Object.keys(SCENARIO_LABELS) as (keyof typeof SCENARIO_LABELS)[]).map(
  (value) => ({ value, label: SCENARIO_LABELS[value] }),
);

/** 画像数值输入的推荐快捷选项（写死常用档位，避免拖拽） */
const MEMORY_QUICK_OPTIONS = [4, 8, 16, 32, 64];
const CPU_QUICK_OPTIONS = [2, 4, 8, 16];
const CONCURRENCY_QUICK_OPTIONS = [50, 100, 200, 500, 1000];

/** 监听范围选项（驱动 listen_addresses 推荐值；PG 默认仅本机，与 MySQL 的默认所有接口相反） */
const LISTEN_SCOPE_OPTIONS = [
  { value: 'loopback', label: '仅本机（默认）' },
  { value: 'intranet', label: '仅内网网卡' },
  { value: 'all', label: '所有接口' },
];

/** 各监听范围的联动说明（listen_addresses 输出行为与远程可达性） */
const LISTEN_SCOPE_HINTS: Record<GenerateContext['listenScope'], string> = {
  loopback: '仅本机可连接（适合与应用同机部署），listen_addresses 固定 localhost——PG 默认不对外监听',
  intranet: '仅监听指定内网 IP，外部不可达；仍需 pg_hba.conf 地址白名单与 scram-sha-256 口令配合',
  all: '监听全部接口（含 IPv6）；仅改本参数不会放行客户端——远程可连必须配合 pg_hba.conf 白名单 + 口令认证，并在防火墙放行',
};

/** IPv4 格式校验（点分十进制，每段 0–255；仅用于本地格式提示，不改变引擎取值） */
const IPV4_PATTERN = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** 仅内网监听时绑定 IP 的校验错误文案（空串表示无错误） */
const bindIpError = computed(() => {
  if (props.ctx.listenScope !== 'intranet') return '';
  const ip = props.ctx.bindIp.trim();
  if (!ip) return '仅内网监听必须填写绑定 IP';
  if (!IPV4_PATTERN.test(ip)) return '绑定 IP 格式不正确，请填写合法 IPv4 地址（如 10.0.0.5）';
  return '';
});

/** ctx 枚举字段赋值（OptionRadioGroup 的宽类型收窄） */
function setMode(v: string | number): void {
  props.ctx.mode = v as GenerateContext['mode'];
}
function setVersion(v: string | number): void {
  props.ctx.version = v as GenerateContext['version'];
}
function setDisk(v: string | number): void {
  props.ctx.diskType = v as GenerateContext['diskType'];
}
function setScenario(v: string | number): void {
  props.ctx.scenario = v as GenerateContext['scenario'];
}
function setListenScope(v: string | number): void {
  props.ctx.listenScope = v as GenerateContext['listenScope'];
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

      <!-- 目标版本（三点轴，驱动异步 IO 组显隐与 effective_io_concurrency 默认） -->
      <OptionRadioGroup
        label="目标版本"
        :options="TARGET_VERSIONS"
        :model-value="ctx.version"
        @update:model-value="setVersion"
      />

      <!-- 硬件画像：内存 + CPU 核数（并行组公式的消费方，PG 恢复该输入） -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">物理内存</p>
        <NumberField
          v-model="ctx.memoryGB"
          :min="1"
          :max="512"
          :step="1"
          unit="GB"
          label="物理内存（GB）"
          :quick-options="MEMORY_QUICK_OPTIONS.map((value) => ({ value }))"
        />
      </div>
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">CPU 核数</p>
        <NumberField
          v-model="ctx.cpuCores"
          :min="1"
          :max="128"
          :step="1"
          unit="核"
          label="CPU 核数"
          :quick-options="CPU_QUICK_OPTIONS.map((value) => ({ value }))"
        />
      </div>

      <OptionRadioGroup
        label="磁盘类型"
        :options="DISK_OPTIONS"
        :model-value="ctx.diskType"
        @update:model-value="setDisk"
      />

      <!-- 使用场景 -->
      <OptionRadioGroup
        label="使用场景"
        :options="SCENARIO_OPTIONS"
        :model-value="ctx.scenario"
        @update:model-value="setScenario"
      />

      <!-- 并发 -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">并发连接数预估</p>
        <NumberField
          v-model="ctx.concurrency"
          :min="10"
          :max="10000"
          :step="10"
          unit="连接"
          label="并发连接数预估"
          :quick-options="CONCURRENCY_QUICK_OPTIONS.map((value) => ({ value }))"
        />
      </div>

      <!-- 监听范围：驱动 listen_addresses 推荐值 -->
      <div>
        <OptionRadioGroup
          label="监听范围"
          :options="LISTEN_SCOPE_OPTIONS"
          :model-value="ctx.listenScope"
          @update:model-value="setListenScope"
        />
        <p class="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{{ LISTEN_SCOPE_HINTS[ctx.listenScope] }}</p>
        <div v-if="ctx.listenScope === 'intranet'" class="mt-2">
          <label for="pg-bind-ip" class="mb-1 block text-[0.8125rem] text-muted-foreground">内网 IP（必填）</label>
          <input
            id="pg-bind-ip"
            v-model="ctx.bindIp"
            type="text"
            placeholder="如 10.0.0.5"
            :aria-invalid="bindIpError !== ''"
            aria-describedby="pg-bind-ip-error"
            class="w-full rounded-sm border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
            :class="bindIpError ? 'border-error' : 'border-border'"
          />
          <p v-if="bindIpError" id="pg-bind-ip-error" class="mt-1 text-[0.8125rem] text-error">
            {{ bindIpError }}
          </p>
        </div>
      </div>

      <!-- 端口：同机多实例或规避默认端口扫描时修改（画像字段，直接写 ctx.port） -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">监听端口</p>
        <NumberField
          v-model="ctx.port"
          :min="1"
          :max="65535"
          :step="1"
          unit="端口"
          label="监听端口"
          :quick-options="[{ value: 5432, label: '默认' }, { value: 5433 }]"
        />
      </div>

      <!-- 重置 -->
      <div class="flex justify-end border-t border-border pt-3">
        <button
          type="button"
          class="rounded-sm border border-border bg-card px-4 py-1.5 text-[0.8125rem] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
          title="清空全部自定义覆盖值，恢复当前画像的推荐值"
          @click="emit('reset')"
        >
          重置为推荐值
        </button>
      </div>
    </div>
  </section>
</template>
