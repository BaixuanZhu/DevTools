<script setup lang="ts">
/**
 * 左栏控制面板（本工具私有）：部署模式、硬件画像（内存/磁盘）、使用场景、
 * 目标版本、并发预估、监听范围与端口的快速配置输入区。直接修改传入的
 * reactive ctx 属性（私有组件约定：ctx 由父组件持有，仅属性级变更，不整体替换）。
 *
 * 与 Redis 版的差异：无 CPU 核数（精简参数集下无公式消费方）、无访问密码输入
 * （my.cnf 不管理账号密码，CREATE USER / GRANT 属 SQL 层，见 FAQ 与产物头注释）；
 * 端口为画像字段直接写 ctx.port（Redis 走 overrides，此处由引擎数据模型决定）。
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
  /** 重置为推荐值（父层清空 overrides 并重新随机 server_id 种子） */
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

/** 使用场景选项（label 与 conf 头部注释共用 SCENARIO_LABELS，保证口径一致） */
const SCENARIO_OPTIONS = (Object.keys(SCENARIO_LABELS) as (keyof typeof SCENARIO_LABELS)[]).map(
  (value) => ({ value, label: SCENARIO_LABELS[value] }),
);

/** 画像数值输入的推荐快捷选项（写死常用档位，避免拖拽） */
const MEMORY_QUICK_OPTIONS = [2, 4, 8, 16, 32, 64];
const CONCURRENCY_QUICK_OPTIONS = [50, 100, 200, 500, 1000];

/** 监听范围选项（驱动 bind-address 推荐值） */
const LISTEN_SCOPE_OPTIONS = [
  { value: 'all', label: '所有接口（默认）' },
  { value: 'loopback', label: '仅本机' },
  { value: 'intranet', label: '仅内网网卡' },
];

/** 各监听范围的联动说明（bind-address 输出行为与远程可达性） */
const LISTEN_SCOPE_HINTS: Record<GenerateContext['listenScope'], string> = {
  all: '不输出 bind-address 行——默认值 * 即监听全部接口且含 IPv6（显式 0.0.0.0 反而只绑 IPv4）；远程可达必须配合账号 HOST 限制与防火墙放行',
  loopback: '仅本机可连接（适合与应用同机部署），bind-address 固定 127.0.0.1',
  intranet: '仅监听指定内网 IP，外部不可达；仍建议用专门复制/业务账号的 HOST 限定来源网段',
};

/** 仅内网监听时绑定 IP 必填校验 */
const bindIpError = computed(
  () => props.ctx.listenScope === 'intranet' && !props.ctx.bindIp.trim(),
);

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
function setVersion(v: string | number): void {
  props.ctx.version = v as GenerateContext['version'];
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

      <!-- 硬件画像：仅内存（CPU 核数在精简参数集下无公式消费方，PG 版再评估） -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">物理内存</p>
        <NumberField
          v-model="ctx.memoryGB"
          :min="1"
          :max="1024"
          :step="1"
          unit="GB"
          label="物理内存（GB）"
          :quick-options="MEMORY_QUICK_OPTIONS.map((value) => ({ value }))"
        />
      </div>

      <OptionRadioGroup
        label="磁盘类型"
        :options="DISK_OPTIONS"
        :model-value="ctx.diskType"
        @update:model-value="setDisk"
      />

      <!-- 使用场景 / 目标版本 -->
      <OptionRadioGroup
        label="使用场景"
        :options="SCENARIO_OPTIONS"
        :model-value="ctx.scenario"
        @update:model-value="setScenario"
      />
      <OptionRadioGroup
        label="目标版本"
        :options="TARGET_VERSIONS"
        :model-value="ctx.version"
        @update:model-value="setVersion"
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

      <!-- 监听范围：驱动 bind-address 推荐值 -->
      <div>
        <OptionRadioGroup
          label="监听范围"
          :options="LISTEN_SCOPE_OPTIONS"
          :model-value="ctx.listenScope"
          @update:model-value="setListenScope"
        />
        <p class="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{{ LISTEN_SCOPE_HINTS[ctx.listenScope] }}</p>
        <div v-if="ctx.listenScope === 'intranet'" class="mt-2">
          <label for="mysql-bind-ip" class="mb-1 block text-[0.8125rem] text-muted-foreground">内网 IP（必填）</label>
          <input
            id="mysql-bind-ip"
            v-model="ctx.bindIp"
            type="text"
            placeholder="如 10.0.0.5"
            :aria-invalid="bindIpError"
            aria-describedby="mysql-bind-ip-error"
            class="w-full rounded-sm border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-[border-color] duration-150 focus:border-primary"
            :class="bindIpError ? 'border-error' : 'border-border'"
          />
          <p v-if="bindIpError" id="mysql-bind-ip-error" class="mt-1 text-[0.8125rem] text-error">
            仅内网监听必须填写绑定 IP
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
          :quick-options="[{ value: 3306, label: '默认' }, { value: 3307 }]"
        />
      </div>

      <!-- 重置 -->
      <div class="flex justify-end border-t border-border pt-3">
        <button
          type="button"
          class="rounded-sm border border-border bg-card px-4 py-1.5 text-[0.8125rem] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground"
          title="清空全部自定义覆盖值，恢复推荐值；server_id 重新随机"
          @click="emit('reset')"
        >
          重置为推荐值
        </button>
      </div>
    </div>
  </section>
</template>
