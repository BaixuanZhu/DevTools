<script setup lang="ts">
/**
 * 左栏控制面板（本工具私有）：部署模式、硬件画像、使用场景、持久化策略、
 * 目标版本与并发预估的输入区。直接修改传入的 reactive ctx 属性
 * （私有组件约定：ctx 由父组件持有，仅属性级变更，不整体替换）。
 */
import { computed } from 'vue';
import type { GenerateContext } from '../params';
import { VERSION_OPTIONS } from '../version';
import OptionRadioGroup from '../../../../components/ui/OptionRadioGroup.vue';
import SelectListbox from '../../../../components/ui/SelectListbox.vue';
import ScopeSlider from './ScopeSlider.vue';

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

/** 持久化策略选项 */
const PERSISTENCE_OPTIONS = [
  { value: 'rdb', label: '仅 RDB' },
  { value: 'aof', label: '仅 AOF' },
  { value: 'both', label: 'RDB+AOF' },
  { value: 'off', label: '关闭' },
];

/** 主从模式下主库地址必填校验 */
const masterAddrError = computed(
  () => props.ctx.mode === 'replica' && !props.ctx.masterAddr.trim(),
);

/** ctx 枚举字段赋值（OptionRadioGroup/SelectListbox 的宽类型收窄） */
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
          <ScopeSlider v-model="ctx.cpuCores" :min="1" :max="32" :step="1" unit="核" label="CPU 核数" />
        </div>
        <div>
          <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">物理内存</p>
          <ScopeSlider v-model="ctx.memoryGB" :min="1" :max="256" :step="1" unit="GB" label="物理内存（GB）" />
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

      <!-- 版本 -->
      <SelectListbox
        label="目标版本"
        :options="VERSION_OPTIONS"
        :model-value="ctx.version"
        @update:model-value="setVersion"
      />

      <!-- 并发 -->
      <div>
        <p class="mb-1.5 text-[0.8125rem] text-muted-foreground">并发连接数预估</p>
        <ScopeSlider v-model="ctx.concurrency" :min="50" :max="10000" :step="50" unit="连接" label="并发连接数预估" />
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
